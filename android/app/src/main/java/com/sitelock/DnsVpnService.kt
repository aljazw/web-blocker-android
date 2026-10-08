package com.sitelock

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.content.pm.ServiceInfo
import android.net.ConnectivityManager
import android.net.VpnService
import android.os.Build
import android.os.ParcelFileDescriptor
import android.util.Log
import androidx.core.app.NotificationCompat
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import java.io.FileInputStream
import java.io.FileOutputStream
import java.net.DatagramPacket
import java.net.DatagramSocket
import java.net.Inet4Address
import java.net.InetAddress
import java.nio.ByteBuffer
import java.util.concurrent.atomic.AtomicBoolean

/**
 * Second security layer: a local DNS-filtering VPN.
 *
 * Unlike the accessibility service, a VpnService keeps running even if the user
 * turns accessibility off, so the always-blocked sites stay blocked at the
 * network (name-resolution) level.
 *
 * Design (kept deliberately "DNS only"):
 *  - We set ourselves as the system DNS server (10.111.0.1) and also route a
 *    handful of well-known public resolvers, so normal DNS traffic flows
 *    through us.
 *  - For each DNS query we read the domain. If it is on the always-blocked list
 *    (Full Week + All Day Long entries), we answer NXDOMAIN so the lookup fails
 *    and the site won't load. Everything else we forward to a real upstream
 *    resolver and relay the answer back untouched.
 *
 * Honest limits (documented for the user): apps that use DoH/DoT (encrypted DNS,
 * e.g. Chrome's "Secure DNS", or a hardcoded resolver on port 853) can bypass a
 * plaintext DNS filter. The accessibility layer still covers those in browsers.
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
    private var worker: Thread? = null
    private val running = AtomicBoolean(false)

    @Volatile private var blockedDomains: Set<String> = emptySet()
    @Volatile private var forwardUpstream: String? = null
    private lateinit var prefs: SharedPreferences

    private val prefsListener = SharedPreferences.OnSharedPreferenceChangeListener { _, key ->
        if (key == PREF_BLOCKED || key == PREF_DNS_ENABLED) reloadBlockedDomains()
    }

    override fun onCreate() {
        super.onCreate()
        prefs = applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        prefs.registerOnSharedPreferenceChangeListener(prefsListener)
        reloadBlockedDomains()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_STOP -> {
                stopVpn()
                return START_NOT_STICKY
            }
            else -> startVpn()
        }
        return START_STICKY
    }

    override fun onDestroy() {
        if (::prefs.isInitialized) prefs.unregisterOnSharedPreferenceChangeListener(prefsListener)
        stopVpn()
        super.onDestroy()
    }

    override fun onRevoke() {
        // User disabled the VPN from system settings.
        stopVpn()
        super.onRevoke()
    }

    // ---- lifecycle -------------------------------------------------------

    private fun startVpn() {
        if (running.get()) return

        prefs.edit().putString(PREF_DNS_ENABLED, "true").apply()
        startAsForeground()

        // Where to send ALLOWED (non-blocked) lookups. If the user picked a
        // custom upstream (e.g. AdGuard), we send everything there so they keep
        // that resolver's ad/tracker filtering on top of our site blocking.
        // Otherwise we use the device's own resolvers.
        val custom = customUpstream()
        forwardUpstream = custom

        val systemDns = upstreamDnsServers()
        val primary: String
        val upstreams: List<String>
        if (custom != null) {
            primary = custom
            upstreams = (listOf(custom) + ROUTED_RESOLVERS).distinct()
        } else {
            primary = systemDns.firstOrNull() ?: FALLBACK_UPSTREAM
            upstreams = (systemDns + ROUTED_RESOLVERS).distinct()
        }

        val builder = Builder()
            .setSession("Gaman DNS")
            .addAddress(TUN_ADDRESS, 32)
            .addDnsServer(primary)
        // Route every resolver (the device's own + common public ones) through
        // the tun so their DNS queries reach us for inspection. We do NOT route
        // anything else, so normal traffic is untouched.
        for (ip in upstreams) {
            try { builder.addRoute(ip, 32) } catch (_: Exception) {}
        }
        builder.setBlocking(true)

        // Don't route our own forwarding sockets back into the tunnel.
        try {
            builder.addDisallowedApplication(packageName)
        } catch (_: Exception) { /* ignore */ }

        vpnInterface = try {
            builder.establish()
        } catch (e: Exception) {
            Log.e(TAG, "establish() failed", e)
            null
        }

        if (vpnInterface == null) {
            stopVpn()
            return
        }

        forwardedCount.set(0)
        blockedCount.set(0)
        errorCount.set(0)
        lastError = null
        lastBlocked = null

        running.set(true)
        isRunning.set(true)
        worker = Thread({ runLoop(vpnInterface!!) }, "sitelock-dns").also { it.start() }
    }

    private fun stopVpn() {
        running.set(false)
        isRunning.set(false)
        prefs.edit().putString(PREF_DNS_ENABLED, "false").apply()
        worker?.interrupt()
        worker = null
        try { vpnInterface?.close() } catch (_: Exception) {}
        vpnInterface = null
        stopForegroundCompat()
        stopSelf()
    }

    // ---- packet loop -----------------------------------------------------

    private fun runLoop(iface: ParcelFileDescriptor) {
        val input = FileInputStream(iface.fileDescriptor)
        val output = FileOutputStream(iface.fileDescriptor)
        val packet = ByteArray(32767)

        try {
            while (running.get() && !Thread.currentThread().isInterrupted) {
                val length = input.read(packet)
                if (length <= 0) continue
                try {
                    handlePacket(packet, length, output)
                } catch (e: Exception) {
                    Log.w(TAG, "packet error", e)
                }
            }
        } catch (e: Exception) {
            if (running.get()) Log.e(TAG, "run loop ended", e)
        } finally {
            try { input.close() } catch (_: Exception) {}
            try { output.close() } catch (_: Exception) {}
        }
    }

    /** Parse IPv4/UDP; filter or forward DNS (port 53). */
    private fun handlePacket(packet: ByteArray, length: Int, output: FileOutputStream) {
        val version = (packet[0].toInt() shr 4) and 0xF
        if (version != 4) return // IPv6 not handled in this version

        val ihl = (packet[0].toInt() and 0xF) * 4
        val protocol = packet[9].toInt() and 0xFF
        if (protocol != 17) return // UDP only

        val srcIp = packet.copyOfRange(12, 16)
        val dstIp = packet.copyOfRange(16, 20)

        val udpStart = ihl
        val srcPort = ((packet[udpStart].toInt() and 0xFF) shl 8) or (packet[udpStart + 1].toInt() and 0xFF)
        val dstPort = ((packet[udpStart + 2].toInt() and 0xFF) shl 8) or (packet[udpStart + 3].toInt() and 0xFF)
        val udpHeaderEnd = udpStart + 8
        if (dstPort != 53) return // only DNS

        val dnsData = packet.copyOfRange(udpHeaderEnd, length)
        val domain = parseDnsQuestion(dnsData)

        if (domain != null && isBlocked(domain)) {
            Log.d(TAG, "Blocking DNS: $domain")
            blockedCount.incrementAndGet()
            lastBlocked = domain
            val response = buildNxDomain(dnsData)
            writeUdp(output, dstIp, srcIp, dstPort, srcPort, response)
        } else {
            forwardDns(output, srcIp, dstIp, srcPort, dstPort, dnsData)
        }
    }

    /** Forward a non-blocked DNS query to a real resolver and relay the reply. */
    private fun forwardDns(
        output: FileOutputStream,
        srcIp: ByteArray, dstIp: ByteArray,
        srcPort: Int, dstPort: Int,
        dnsData: ByteArray
    ) {
        val socket = DatagramSocket()
        try {
            protect(socket)
            // Forward to the user's chosen upstream (e.g. AdGuard) if set, so its
            // ad/tracker filtering also applies; otherwise to the resolver the app
            // addressed (which we routed through the tun).
            val fu = forwardUpstream
            val upstream = if (fu != null) InetAddress.getByName(fu) else InetAddress.getByAddress(dstIp)

            socket.soTimeout = 5000
            socket.send(DatagramPacket(dnsData, dnsData.size, upstream, 53))

            val buf = ByteArray(4096)
            val reply = DatagramPacket(buf, buf.size)
            socket.receive(reply)
            val replyData = buf.copyOfRange(0, reply.length)

            // Send the answer back as if it came from the resolver the app asked.
            writeUdp(output, dstIp, srcIp, dstPort, srcPort, replyData)
            forwardedCount.incrementAndGet()
        } catch (e: Exception) {
            Log.w(TAG, "forward failed", e)
            errorCount.incrementAndGet()
            lastError = e.message
        } finally {
            socket.close()
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
     * NXDOMAIN response = DNS header + the original question ONLY.
     *
     * We must TRUNCATE after the question. The incoming query often carries an
     * EDNS OPT record in its additional section; if we keep those bytes but set
     * the record counts to 0, the reply is malformed and the stub resolver
     * discards it — then the lookup succeeds elsewhere and the block "fails".
     * Trimming to the question gives a clean, honored NXDOMAIN.
     */
    private fun buildNxDomain(query: ByteArray): ByteArray {
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
        // Flags: QR=1, Opcode 0, AA=0, TC=0, RD copied, RA=1, RCODE=3 (NXDOMAIN)
        resp[2] = (0x80 or (query[2].toInt() and 0x01)).toByte()
        resp[3] = 0x83.toByte()
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

    /** User-chosen upstream resolver (e.g. AdGuard), or null to use system DNS. */
    private fun customUpstream(): String? {
        val v = prefs.getString(PREF_UPSTREAM, null)
        return if (v.isNullOrBlank()) null else v.trim()
    }

    /** The device's current IPv4 DNS servers, read from the active network. */
    private fun upstreamDnsServers(): List<String> {
        return try {
            val cm = getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
            val net = cm.activeNetwork ?: return emptyList()
            val lp = cm.getLinkProperties(net) ?: return emptyList()
            lp.dnsServers
                .filterIsInstance<Inet4Address>()
                .mapNotNull { it.hostAddress }
        } catch (e: Exception) {
            Log.w(TAG, "could not read system DNS", e)
            emptyList()
        }
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
        blockedDomains.any { host == it || host.endsWith(".$it") }

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
        private const val TAG = "SiteLockDns"
        const val ACTION_START = "com.sitelock.DNS_START"
        const val ACTION_STOP = "com.sitelock.DNS_STOP"

        private const val PREFS_NAME = "BlockedPrefs"
        private const val PREF_BLOCKED = "@blocked_websites"
        private const val PREF_DNS_ENABLED = "@dns_enabled"
        private const val PREF_UPSTREAM = "@dns_upstream"

        private const val TUN_ADDRESS = "10.111.0.2"
        private const val FALLBACK_UPSTREAM = "1.1.1.1"
        private val ROUTED_RESOLVERS = listOf(
            "8.8.8.8", "8.8.4.4", "1.1.1.1", "1.0.0.1", "9.9.9.9"
        )

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
