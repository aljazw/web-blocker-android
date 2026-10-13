package com.gaman

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.content.pm.ServiceInfo
import android.database.ContentObserver
import android.net.ConnectivityManager
import android.net.LinkProperties
import android.net.Network
import android.net.VpnService
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.ParcelFileDescriptor
import android.provider.Settings
import android.system.ErrnoException
import android.system.Os
import android.system.OsConstants
import android.system.StructPollfd
import android.util.Log
import androidx.core.app.NotificationCompat
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import java.io.FileInputStream
import java.io.FileOutputStream
import java.nio.ByteBuffer
import java.util.concurrent.ArrayBlockingQueue
import java.util.concurrent.ThreadPoolExecutor
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicInteger

/**
 * Second security layer: a local DNS-filtering VPN.
 *
 * Unlike the accessibility service, a VpnService keeps running even if the user
 * turns accessibility off, so the always-blocked sites stay blocked at the
 * network (name-resolution) level.
 *
 * Design, built so it can never take the phone offline:
 *  - Only DNS goes through the tunnel. The VPN advertises one virtual DNS server
 *    (10.111.0.1) and routes nothing but that address, so every other packet
 *    uses the normal network untouched.
 *  - Blocked domains get NXDOMAIN. Every other lookup is handed to
 *    [DnsForwarder], which tries the user's resolver, then the DNS servers of
 *    the network the phone is on right now, then public resolvers. Network
 *    switches (Wi-Fi <-> mobile data) are tracked live; the old version pinned
 *    the Wi-Fi router's DNS and went dark on mobile data.
 *  - Lookups run in parallel, so one slow answer can't stall the rest.
 *  - If Android's Private DNS is set to a hostname, Android insists on talking
 *    to that server itself; filtering through the tunnel would fail every
 *    lookup. The tunnel then stops advertising DNS (pass-through) so the
 *    internet keeps working, and Settings explains how to move that hostname
 *    into Gaman, which speaks it over encrypted DNS-over-TLS.
 *  - If the packet loop dies or the tunnel can't be built, it rebuilds itself.
 *
 * Honest limits: apps that use their own encrypted DNS (e.g. Chrome's "Secure
 * DNS") bypass a DNS filter. The accessibility layer still covers browsers.
 * Only one VPN can be active on Android at a time.
 */
class DnsVpnService : VpnService() {

    // Nullable: Gson ignores Kotlin null-safety, and one malformed entry must not
    // empty the whole DNS block list.
    data class BlockedWebsite(
        val days: String? = null,
        val time: String? = null,
        val websiteUrl: String? = null,
        val visible: Boolean? = null
    )

    private var vpnInterface: ParcelFileDescriptor? = null
    private val running = AtomicBoolean(false)
    /** Bumped on every rebuild so a stale packet loop knows to exit quietly. */
    private val generation = AtomicInteger(0)
    private var passThrough = false
    private var retryDelayMs = MIN_RETRY_MS

    private val main = Handler(Looper.getMainLooper())
    private lateinit var forwarder: DnsForwarder
    private var lookups: ThreadPoolExecutor? = null
    private var networkCallback: ConnectivityManager.NetworkCallback? = null
    private var privateDnsObserver: ContentObserver? = null
    @Volatile private var underlying: Network? = null

    @Volatile private var blockedDomains: Set<String> = emptySet()
    @Volatile private var vacation: Vacation? = null
    private lateinit var prefs: SharedPreferences

    private val prefsListener = SharedPreferences.OnSharedPreferenceChangeListener { _, key ->
        if (key == PREF_BLOCKED) reloadBlockedDomains()
        if (key == PREF_UPSTREAM) { forwarder.custom = customUpstream(); forwarder.reset() }
        if (key == Vacation.KEY) vacation = Vacation.load(prefs)
    }

    private val rebuild = Runnable { if (running.get()) buildTunnel() }

    override fun onCreate() {
        super.onCreate()
        prefs = applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        forwarder = DnsForwarder(this)
        prefs.registerOnSharedPreferenceChangeListener(prefsListener)
        reloadBlockedDomains()
        vacation = Vacation.load(prefs)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_STOP -> {
                prefs.edit().putString(PREF_DNS_ENABLED, "false").apply()
                stopVpn()
                return START_NOT_STICKY
            }
            else -> startVpn()
        }
        return START_STICKY
    }

    override fun onDestroy() {
        if (::prefs.isInitialized) prefs.unregisterOnSharedPreferenceChangeListener(prefsListener)
        // Not a user "off": the system may be reclaiming memory. Keep the
        // enabled flag so boot / always-on bring the filter back.
        stopVpn()
        super.onDestroy()
    }

    override fun onRevoke() {
        // The user disabled the VPN in system settings, or another VPN took over.
        prefs.edit().putString(PREF_DNS_ENABLED, "false").apply()
        stopVpn()
        super.onRevoke()
    }

    // ---- lifecycle -------------------------------------------------------

    private fun startVpn() {
        if (running.get()) return
        prefs.edit().putString(PREF_DNS_ENABLED, "true").apply()
        startAsForeground()

        forwardedCount.set(0)
        blockedCount.set(0)
        errorCount.set(0)
        lastError = null
        lastBlocked = null

        forwarder.custom = customUpstream()
        lookups = ThreadPoolExecutor(
            4, 16, 30, TimeUnit.SECONDS,
            ArrayBlockingQueue(256),
            // Under a flood, drop the oldest lookup: its app has given up on it anyway.
            ThreadPoolExecutor.DiscardOldestPolicy()
        )
        running.set(true)
        isRunning.set(true)
        watchNetwork()
        watchPrivateDns()
        buildTunnel()
    }

    private fun stopVpn() {
        running.set(false)
        isRunning.set(false)
        privateDnsActive = false
        main.removeCallbacks(rebuild)
        generation.incrementAndGet()
        unwatchNetwork()
        unwatchPrivateDns()
        lookups?.shutdownNow()
        lookups = null
        try { vpnInterface?.close() } catch (_: Exception) {}
        vpnInterface = null
        if (::forwarder.isInitialized) forwarder.reset()
        stopForegroundCompat()
        stopSelf()
    }

    /**
     * (Re)builds the tunnel for the current situation. The new interface is
     * established before the old one is closed, so there is no gap where an
     * always-on VPN would cut the connection.
     */
    @Synchronized
    private fun buildTunnel() {
        if (!running.get()) return
        main.removeCallbacks(rebuild)
        val strict = strictPrivateDnsHost() != null
        privateDnsActive = strict

        val builder = Builder()
            .setSession("Gaman DNS")
            .addAddress(TUN_ADDRESS, 32)
            .addRoute(DNS_ADDRESS, 32)
            .setBlocking(true)
        // In pass-through no DNS server is set, so Android keeps using the
        // network's own DNS (and the user's Private DNS) directly.
        if (!strict) builder.addDnsServer(DNS_ADDRESS)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            // Inherit metered-ness from the real network instead of marking
            // everything metered.
            builder.setMetered(false)
            underlying?.let { builder.setUnderlyingNetworks(arrayOf(it)) }
        }
        // Gaman's own forwarding sockets must not loop back into the tunnel.
        try { builder.addDisallowedApplication(packageName) } catch (_: Exception) {}

        val iface = try { builder.establish() } catch (e: Exception) {
            Log.e(TAG, "establish() failed", e)
            null
        }
        if (iface == null) {
            // Consent missing (prepare() needed) means the user must act; otherwise retry.
            if (prepare(this) != null) { stopVpn(); return }
            scheduleRebuild()
            return
        }

        val old = vpnInterface
        vpnInterface = iface
        passThrough = strict
        val gen = generation.incrementAndGet()
        Thread({ runLoop(iface, gen) }, "gaman-dns").start()
        try { old?.close() } catch (_: Exception) {}
        retryDelayMs = MIN_RETRY_MS
    }

    private fun scheduleRebuild() {
        if (!running.get()) return
        main.removeCallbacks(rebuild)
        main.postDelayed(rebuild, retryDelayMs)
        retryDelayMs = (retryDelayMs * 2).coerceAtMost(MAX_RETRY_MS)
    }

    // ---- network tracking -------------------------------------------------

    private fun watchNetwork() {
        val cm = getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        // Gaman is excluded from its own VPN, so its default network is the real one.
        val callback = object : ConnectivityManager.NetworkCallback() {
            override fun onAvailable(network: Network) {
                underlying = network
                onNetworkChanged(cm, network)
            }

            override fun onLinkPropertiesChanged(network: Network, lp: LinkProperties) {
                underlying = network
                onNetworkChanged(cm, network)
            }

            override fun onLost(network: Network) {
                if (underlying == network) underlying = null
                forwarder.networkDns = emptyList()
            }
        }
        try {
            cm.registerDefaultNetworkCallback(callback)
            networkCallback = callback
        } catch (e: Exception) {
            Log.w(TAG, "network callback failed", e)
        }
    }

    private fun onNetworkChanged(cm: ConnectivityManager, network: Network) {
        val lp = try { cm.getLinkProperties(network) } catch (_: Exception) { null }
        val servers = lp?.dnsServers.orEmpty().filter {
            val ip = it.hostAddress
            ip != DNS_ADDRESS && ip != TUN_ADDRESS && !it.isLoopbackAddress
        }
        if (servers != forwarder.networkDns) {
            forwarder.networkDns = servers
            forwarder.reset()
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP_MR1) {
            try { setUnderlyingNetworks(arrayOf(network)) } catch (_: Exception) {}
        }
        // Private DNS can flip with the network; adjust the tunnel if it did.
        main.post { if (running.get() && (strictPrivateDnsHost() != null) != passThrough) buildTunnel() }
    }

    private fun unwatchNetwork() {
        val callback = networkCallback ?: return
        networkCallback = null
        try {
            (getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager)
                .unregisterNetworkCallback(callback)
        } catch (_: Exception) {}
    }

    private fun watchPrivateDns() {
        val observer = object : ContentObserver(main) {
            override fun onChange(selfChange: Boolean) {
                if (running.get() && (strictPrivateDnsHost() != null) != passThrough) buildTunnel()
            }
        }
        try {
            for (key in listOf(SETTING_PRIVATE_DNS_MODE, SETTING_PRIVATE_DNS_HOST)) {
                contentResolver.registerContentObserver(Settings.Global.getUriFor(key), false, observer)
            }
            privateDnsObserver = observer
        } catch (e: Exception) {
            Log.w(TAG, "private DNS observer failed", e)
        }
    }

    private fun unwatchPrivateDns() {
        val observer = privateDnsObserver ?: return
        privateDnsObserver = null
        try { contentResolver.unregisterContentObserver(observer) } catch (_: Exception) {}
    }

    /** The hostname when Android's Private DNS is in strict ("hostname") mode, else null. */
    private fun strictPrivateDnsHost(): String? = privateDnsHost(this, underlying)

    // ---- packet loop -----------------------------------------------------

    private fun runLoop(iface: ParcelFileDescriptor, gen: Int) {
        val input = FileInputStream(iface.fileDescriptor)
        val output = FileOutputStream(iface.fileDescriptor)
        val packet = ByteArray(32767)
        val poll = arrayOf(StructPollfd().apply { fd = iface.fileDescriptor; events = OsConstants.POLLIN.toShort() })

        try {
            while (running.get() && generation.get() == gen) {
                // Poll with a timeout so a replaced tunnel's loop always notices and exits.
                val ready = try { Os.poll(poll, 1000) } catch (e: ErrnoException) {
                    if (e.errno == OsConstants.EINTR) 0 else throw e
                }
                if (ready <= 0) continue
                val length = input.read(packet)
                if (length <= 0) continue
                try {
                    handlePacket(packet, length, output)
                } catch (e: Exception) {
                    Log.w(TAG, "packet error", e)
                }
            }
        } catch (e: Exception) {
            if (running.get() && generation.get() == gen) Log.e(TAG, "run loop ended", e)
        } finally {
            try { input.close() } catch (_: Exception) {}
            try { output.close() } catch (_: Exception) {}
        }
        // The current tunnel's loop died unexpectedly: rebuild instead of
        // leaving a tunnel that swallows every lookup.
        if (running.get() && generation.get() == gen) main.post { scheduleRebuild() }
    }

    /** Parse IPv4/UDP; answer blocked DNS lookups here and forward the rest. */
    private fun handlePacket(packet: ByteArray, length: Int, output: FileOutputStream) {
        if (length < 28) return
        val version = (packet[0].toInt() shr 4) and 0xF
        if (version != 4) return // the tunnel only has an IPv4 address

        val ihl = (packet[0].toInt() and 0xF) * 4
        val protocol = packet[9].toInt() and 0xFF
        if (protocol != 17 || length < ihl + 8) return // UDP only

        val srcIp = packet.copyOfRange(12, 16)
        val dstIp = packet.copyOfRange(16, 20)

        val udpStart = ihl
        val srcPort = ((packet[udpStart].toInt() and 0xFF) shl 8) or (packet[udpStart + 1].toInt() and 0xFF)
        val dstPort = ((packet[udpStart + 2].toInt() and 0xFF) shl 8) or (packet[udpStart + 3].toInt() and 0xFF)
        val udpHeaderEnd = udpStart + 8
        if (dstPort != 53) return // only DNS

        val dnsData = packet.copyOfRange(udpHeaderEnd, length)
        if (dnsData.size < 12) return
        val domain = parseDnsQuestion(dnsData)

        if (domain != null && isBlocked(domain)) {
            Log.d(TAG, "Blocking DNS: $domain")
            blockedCount.incrementAndGet()
            lastBlocked = domain
            writeUdp(output, dstIp, srcIp, dstPort, srcPort, buildReply(dnsData, RCODE_NXDOMAIN))
            return
        }
        val pool = lookups ?: return
        try {
            pool.execute { forwardDns(output, srcIp, dstIp, srcPort, dstPort, dnsData) }
        } catch (_: Exception) {
            // Pool shut down mid-stop.
        }
    }

    /** Resolve a non-blocked lookup off the packet thread and relay the reply. */
    private fun forwardDns(
        output: FileOutputStream,
        srcIp: ByteArray, dstIp: ByteArray,
        srcPort: Int, dstPort: Int,
        dnsData: ByteArray
    ) {
        val reply = forwarder.resolve(dnsData)
        try {
            if (reply != null) {
                writeUdp(output, dstIp, srcIp, dstPort, srcPort, reply)
                forwardedCount.incrementAndGet()
            } else {
                // Fail fast so the app's resolver retries instead of hanging.
                errorCount.incrementAndGet()
                writeUdp(output, dstIp, srcIp, dstPort, srcPort, buildReply(dnsData, RCODE_SERVFAIL))
            }
        } catch (e: Exception) {
            // Tunnel was rebuilt while this lookup was in flight; the app retries.
            Log.w(TAG, "reply write failed", e)
        }
    }

    // ---- DNS helpers -----------------------------------------------------

    /** Returns the lower-cased queried domain from a DNS message, or null. */
    private fun parseDnsQuestion(dns: ByteArray): String? {
        if (dns.size < 13) return null
        var pos = 12 // skip 12-byte header
        val sb = StringBuilder()
        while (pos < dns.size) {
            val len = dns[pos].toInt() and 0xFF
            if (len == 0) break
            if (len and 0xC0 != 0) return null // compression pointer — ignore
            pos++
            if (pos + len > dns.size) return null
            if (sb.isNotEmpty()) sb.append('.')
            sb.append(String(dns, pos, len, Charsets.US_ASCII))
            pos += len
        }
        return if (sb.isEmpty()) null else sb.toString().lowercase()
    }

    /**
     * Error reply (NXDOMAIN / SERVFAIL) = DNS header + the original question ONLY.
     *
     * We must TRUNCATE after the question. The incoming query often carries an
     * EDNS OPT record in its additional section; if we keep those bytes but set
     * the record counts to 0, the reply is malformed and the stub resolver
     * discards it — then the lookup succeeds elsewhere and the block "fails".
     * Trimming to the question gives a clean, honored NXDOMAIN.
     */
    private fun buildReply(query: ByteArray, rcode: Int): ByteArray {
        // Find the end of the question section: skip the 12-byte header, walk the
        // QNAME labels to the 0 terminator, then +4 for QTYPE(2) + QCLASS(2).
        var pos = 12
        while (pos < query.size) {
            val len = query[pos].toInt() and 0xFF
            if (len == 0) { pos += 1; break }
            if (len and 0xC0 != 0) { pos += 2; break } // compression pointer (unexpected here)
            pos += len + 1
        }
        val questionEnd = (pos + 4).coerceAtMost(query.size)

        val resp = query.copyOfRange(0, questionEnd)
        // Flags: QR=1, Opcode 0, AA=0, TC=0, RD copied, RA=1, RCODE as given
        resp[2] = (0x80 or (query[2].toInt() and 0x01)).toByte()
        resp[3] = (0x80 or rcode).toByte()
        // Counts: exactly one question, no answer/authority/additional records.
        resp[4] = 0; resp[5] = 1
        resp[6] = 0; resp[7] = 0
        resp[8] = 0; resp[9] = 0
        resp[10] = 0; resp[11] = 0
        return resp
    }

    /** Build an IPv4+UDP packet and write it to the tun. */
    private fun writeUdp(
        output: FileOutputStream,
        srcIp: ByteArray, dstIp: ByteArray,
        srcPort: Int, dstPort: Int,
        payload: ByteArray
    ) {
        val udpLen = 8 + payload.size
        val totalLen = 20 + udpLen
        val buf = ByteBuffer.allocate(totalLen)

        // ---- IPv4 header (20 bytes) ----
        buf.put(0x45.toByte())            // version 4, IHL 5
        buf.put(0)                        // DSCP/ECN
        buf.putShort(totalLen.toShort())  // total length
        buf.putShort(0)                   // identification
        buf.putShort(0x4000.toShort())    // flags: Don't Fragment
        buf.put(64)                       // TTL
        buf.put(17)                       // protocol UDP
        buf.putShort(0)                   // checksum placeholder
        buf.put(srcIp)
        buf.put(dstIp)

        // ---- UDP header (8 bytes) ----
        buf.putShort(srcPort.toShort())
        buf.putShort(dstPort.toShort())
        buf.putShort(udpLen.toShort())
        buf.putShort(0)                   // UDP checksum (0 = not computed, allowed on IPv4)
        buf.put(payload)

        val bytes = buf.array()
        // IPv4 header checksum over the first 20 bytes.
        val ipChecksum = checksum(bytes, 0, 20)
        bytes[10] = (ipChecksum shr 8).toByte()
        bytes[11] = (ipChecksum and 0xFF).toByte()

        synchronized(output) { output.write(bytes); output.flush() }
    }

    private fun checksum(data: ByteArray, offset: Int, len: Int): Int {
        var sum = 0L
        var i = offset
        val end = offset + len
        while (i + 1 < end) {
            sum += ((data[i].toInt() and 0xFF) shl 8) or (data[i + 1].toInt() and 0xFF)
            i += 2
        }
        if (i < end) sum += (data[i].toInt() and 0xFF) shl 8
        while (sum shr 16 != 0L) sum = (sum and 0xFFFF) + (sum shr 16)
        return (sum.inv() and 0xFFFF).toInt()
    }

    /** User-chosen resolver (an IP, or a Private DNS hostname), or null for automatic. */
    private fun customUpstream(): String? {
        val v = prefs.getString(PREF_UPSTREAM, null)
        return if (v.isNullOrBlank()) null else v.trim()
    }

    // ---- block list ------------------------------------------------------

    private fun reloadBlockedDomains() {
        val json = prefs.getString(PREF_BLOCKED, null)
        if (json.isNullOrEmpty()) { blockedDomains = emptySet(); return }
        blockedDomains = try {
            val type = object : TypeToken<List<BlockedWebsite?>>() {}.type
            val list: List<BlockedWebsite?> = Gson().fromJson(json, type) ?: emptyList()
            list.asSequence()
                .filterNotNull()
                // DNS only for always-blocked sites (no open window), per design.
                .filter { it.days.equals("Full Week", true) && it.time.equals("All Day Long", true) }
                .mapNotNull { it.websiteUrl }
                .map { domainOf(it) }
                .filter { it.isNotEmpty() }
                .toSet()
        } catch (e: Exception) {
            Log.e(TAG, "parse blocked list failed", e)
            emptySet()
        }
        ruleCount = blockedDomains.size
        Log.d(TAG, "DNS blocked domains: $blockedDomains")
    }

    private fun domainOf(url: String): String =
        url.trim().lowercase()
            .removePrefix("https://").removePrefix("http://").removePrefix("www.")
            .substringBefore('/')

    private fun isBlocked(host: String): Boolean =
        vacation?.isActive() != true && blockedDomains.any { host == it || host.endsWith(".$it") }

    // ---- foreground ------------------------------------------------------

    private fun startAsForeground() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            nm.createNotificationChannel(
                NotificationChannel(CHANNEL, "Gaman DNS", NotificationManager.IMPORTANCE_MIN)
                    .apply { description = "Network-level blocking for always-blocked sites." }
            )
        }
        val tap = PendingIntent.getActivity(
            this, 0,
            packageManager.getLaunchIntentForPackage(packageName) ?: Intent(),
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M)
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            else PendingIntent.FLAG_UPDATE_CURRENT
        )
        val notif: Notification = NotificationCompat.Builder(this, CHANNEL)
            .setContentTitle("Gaman DNS protection active")
            .setContentText("Blocking always-blocked sites at the network level.")
            .setSmallIcon(android.R.drawable.ic_lock_idle_lock)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_MIN)
            .setContentIntent(tap)
            .build()

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            val type = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE)
                ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE else 0
            startForeground(DNS_NOTIF_ID, notif, type)
        } else {
            startForeground(DNS_NOTIF_ID, notif)
        }
    }

    private fun stopForegroundCompat() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            stopForeground(STOP_FOREGROUND_REMOVE)
        } else {
            @Suppress("DEPRECATION") stopForeground(true)
        }
    }

    companion object {
        private const val TAG = "GamanDns"
        const val ACTION_START = "com.gaman.DNS_START"
        const val ACTION_STOP = "com.gaman.DNS_STOP"

        private const val PREFS_NAME = "BlockedPrefs"
        private const val PREF_BLOCKED = "@blocked_websites"
        private const val PREF_DNS_ENABLED = "@dns_enabled"
        private const val PREF_UPSTREAM = "@dns_upstream"

        private const val TUN_ADDRESS = "10.111.0.2"
        /** Virtual DNS server; the only address routed into the tunnel. */
        private const val DNS_ADDRESS = "10.111.0.1"
        private const val RCODE_SERVFAIL = 2
        private const val RCODE_NXDOMAIN = 3
        private const val MIN_RETRY_MS = 2_000L
        private const val MAX_RETRY_MS = 60_000L

        // Android's own keys (Settings.Global.PRIVATE_DNS_*, hidden from the SDK).
        private const val SETTING_PRIVATE_DNS_MODE = "private_dns_mode"
        private const val SETTING_PRIVATE_DNS_HOST = "private_dns_specifier"

        // Channel ids predate the rename; kept so existing notification settings carry over.
        private const val CHANNEL = "sitelock_dns"
        private const val DNS_NOTIF_ID = 1003

        /** Lets the JS bridge and BootReceiver know if filtering is live. */
        val isRunning = AtomicBoolean(false)

        // Live diagnostics, surfaced in the app's status panel.
        val forwardedCount = java.util.concurrent.atomic.AtomicInteger(0)
        val blockedCount = java.util.concurrent.atomic.AtomicInteger(0)
        val errorCount = java.util.concurrent.atomic.AtomicInteger(0)
        @Volatile var ruleCount = 0
        @Volatile var lastError: String? = null
        @Volatile var lastBlocked: String? = null
        /** True while Android's Private DNS hostname mode has the filter in pass-through. */
        @Volatile var privateDnsActive = false

        /**
         * The Private DNS hostname when Android is in strict ("hostname") mode,
         * else null. Reads the setting, and falls back to what the network
         * reports in case the setting can't be read.
         */
        fun privateDnsHost(context: Context, network: Network? = null): String? {
            try {
                val cr = context.contentResolver
                val mode = Settings.Global.getString(cr, SETTING_PRIVATE_DNS_MODE)
                if (mode == "hostname") {
                    Settings.Global.getString(cr, SETTING_PRIVATE_DNS_HOST)?.trim()?.takeIf { it.isNotEmpty() }
                        ?.let { return it }
                } else if (mode != null) {
                    return null
                }
            } catch (_: Exception) {}
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                try {
                    val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
                    val net = network ?: cm.activeNetwork ?: return null
                    return cm.getLinkProperties(net)?.privateDnsServerName
                } catch (_: Exception) {}
            }
            return null
        }

        fun start(context: Context) {
            val i = Intent(context, DnsVpnService::class.java).setAction(ACTION_START)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O)
                context.startForegroundService(i) else context.startService(i)
        }

        fun stop(context: Context) {
            context.startService(Intent(context, DnsVpnService::class.java).setAction(ACTION_STOP))
        }
    }
}
