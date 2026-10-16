package com.disciplineapp

import android.net.VpnService
import android.util.Log
import java.io.DataInputStream
import java.io.DataOutputStream
import java.io.IOException
import java.net.DatagramPacket
import java.net.DatagramSocket
import java.net.InetAddress
import java.net.InetSocketAddress
import java.net.Socket
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.ConcurrentLinkedQueue
import javax.net.ssl.HttpsURLConnection
import javax.net.ssl.SSLSocket
import javax.net.ssl.SSLSocketFactory

/**
 * Resolves the lookups the app lets through (everything that isn't blocked).
 *
 * It never depends on a single resolver. Each lookup walks a chain and the
 * first answer wins:
 *   1. the resolver the user picked (an IP, or a Private DNS hostname such as
 *      dns.adguard-dns.com, which is spoken over encrypted DNS-over-TLS),
 *   2. the DNS servers of the network the phone is on *right now* (they are
 *      re-read on every Wi-Fi / mobile data switch),
 *   3. public resolvers (Cloudflare, Google, Quad9).
 * A resolver that just failed is tried last for a short while, so a dead one
 * costs one timeout, not one per lookup.
 *
 * All sockets are protected, so they leave through the real network and never
 * loop back into the tunnel.
 */
class DnsForwarder(private val vpn: VpnService) {

    private sealed class Upstream(val key: String) {
        class Udp(val address: InetAddress) : Upstream("udp:${address.hostAddress}")
        class Tls(val host: String) : Upstream("tls:$host")
    }

    /**
     * "" / null = automatic; an IP literal = plain DNS; a hostname = DoT. Anything
     * else (a typo, an old value) is ignored, so it can never break every lookup.
     */
    @Volatile var custom: String? = null
        set(value) {
            field = value
            customUpstream = parseUpstream(value)
        }
    @Volatile private var customUpstream: Upstream? = null

    private val fallbacks: List<Upstream> = FALLBACKS.map { Upstream.Udp(InetAddress.getByName(it)) }

    /** DNS servers of the current physical network, kept fresh by the service. */
    @Volatile var networkDns: List<InetAddress> = emptyList()

    private val recentFailures = ConcurrentHashMap<String, Long>()
    private val tlsPool = ConcurrentHashMap<String, ConcurrentLinkedQueue<SSLSocket>>()
    private val hostCache = ConcurrentHashMap<String, Pair<List<InetAddress>, Long>>()

    /** Returns the upstream's raw DNS reply, or null if every resolver failed. */
    fun resolve(query: ByteArray): ByteArray? {
        val chain = chain()
        val now = System.currentTimeMillis()
        // Healthy resolvers first, recently failed ones at the back (never dropped).
        val ordered = chain.sortedBy { if (now - (recentFailures[it.key] ?: 0L) < FAILURE_COOLDOWN_MS) 1 else 0 }
        for (upstream in ordered) {
            val reply = try {
                when (upstream) {
                    is Upstream.Udp -> queryUdp(upstream.address, query)
                    is Upstream.Tls -> queryTls(upstream.host, query)
                }
            } catch (e: Exception) {
                Log.w(TAG, "${upstream.key} failed: ${e.message}")
                DnsVpnService.lastError = "${upstream.key}: ${e.message}"
                null
            }
            if (reply != null) {
                recentFailures.remove(upstream.key)
                return reply
            }
            recentFailures[upstream.key] = System.currentTimeMillis()
        }
        return null
    }

    /** Drops cached connections and failure marks, e.g. after a network switch. */
    fun reset() {
        recentFailures.clear()
        hostCache.clear()
        for (queue in tlsPool.values) {
            while (true) {
                val s = queue.poll() ?: break
                closeQuietly(s)
            }
        }
    }

    private fun chain(): List<Upstream> =
        (listOfNotNull(customUpstream) + networkDns.take(2).map { Upstream.Udp(it) } + fallbacks).distinctBy { it.key }

    private fun parseUpstream(value: String?): Upstream? {
        val v = value?.trim()?.lowercase().orEmpty()
        return when {
            v.isEmpty() -> null
            // A valid literal never triggers a lookup; anything else is rejected first.
            isIpLiteral(v) -> try { Upstream.Udp(InetAddress.getByName(v)) } catch (_: Exception) { null }
            HOSTNAME.matches(v) -> Upstream.Tls(v)
            else -> null
        }
    }

    // ---- plain DNS --------------------------------------------------------

    private fun queryUdp(server: InetAddress, query: ByteArray): ByteArray? {
        DatagramSocket().use { socket ->
            vpn.protect(socket)
            socket.soTimeout = UDP_TIMEOUT_MS
            socket.send(DatagramPacket(query, query.size, server, 53))
            val buf = ByteArray(4096)
            val deadline = System.currentTimeMillis() + UDP_TIMEOUT_MS
            while (System.currentTimeMillis() < deadline) {
                val packet = DatagramPacket(buf, buf.size)
                socket.receive(packet) // throws on timeout
                val reply = buf.copyOfRange(0, packet.length)
                if (!sameId(query, reply)) continue // stray / spoofed answer
                // Truncated: the full answer only fits over TCP.
                if (reply.size > 2 && (reply[2].toInt() and 0x02) != 0) return queryTcp(server, query)
                return reply
            }
        }
        return null
    }

    private fun queryTcp(server: InetAddress, query: ByteArray): ByteArray {
        Socket().use { socket ->
            vpn.protect(socket)
            socket.connect(InetSocketAddress(server, 53), CONNECT_TIMEOUT_MS)
            socket.soTimeout = STREAM_TIMEOUT_MS
            return exchange(socket, query)
        }
    }

    // ---- DNS-over-TLS (Private DNS) ---------------------------------------

    private fun queryTls(host: String, query: ByteArray): ByteArray {
        val pool = tlsPool.getOrPut(host) { ConcurrentLinkedQueue() }
        // A pooled connection may have been closed by the server while idle.
        pool.poll()?.let { pooled ->
            try {
                val reply = exchange(pooled, query)
                if (pool.size < MAX_POOLED) pool.offer(pooled) else closeQuietly(pooled)
                return reply
            } catch (_: Exception) {
                closeQuietly(pooled)
            }
        }
        val fresh = openTls(host)
        try {
            val reply = exchange(fresh, query)
            if (pool.size < MAX_POOLED) pool.offer(fresh) else closeQuietly(fresh)
            return reply
        } catch (e: Exception) {
            closeQuietly(fresh)
            throw e
        }
    }

    private fun openTls(host: String): SSLSocket {
        var last: Exception? = null
        for (address in resolveHost(host)) {
            val raw = Socket()
            try {
                vpn.protect(raw)
                raw.connect(InetSocketAddress(address, 853), CONNECT_TIMEOUT_MS)
                raw.soTimeout = STREAM_TIMEOUT_MS
                val tls = (SSLSocketFactory.getDefault() as SSLSocketFactory)
                    .createSocket(raw, host, 853, true) as SSLSocket
                tls.startHandshake()
                if (!HttpsURLConnection.getDefaultHostnameVerifier().verify(host, tls.session)) {
                    closeQuietly(tls)
                    throw IOException("certificate does not match $host")
                }
                return tls
            } catch (e: Exception) {
                closeQuietly(raw)
                last = e
            }
        }
        throw last ?: IOException("could not resolve $host")
    }

    /** Resolves a DoT hostname outside the tunnel (the app is excluded from its own VPN). */
    private fun resolveHost(host: String): List<InetAddress> {
        val cached = hostCache[host]
        if (cached != null && System.currentTimeMillis() - cached.second < HOST_CACHE_MS) return cached.first
        return try {
            val addresses = InetAddress.getAllByName(host).toList()
            hostCache[host] = addresses to System.currentTimeMillis()
            addresses
        } catch (e: Exception) {
            // Keep using a stale answer rather than failing every lookup.
            cached?.first ?: throw e
        }
    }

    /** One length-prefixed DNS exchange over TCP or TLS. */
    private fun exchange(socket: Socket, query: ByteArray): ByteArray {
        val out = DataOutputStream(socket.getOutputStream())
        val framed = ByteArray(query.size + 2)
        framed[0] = (query.size shr 8).toByte()
        framed[1] = query.size.toByte()
        System.arraycopy(query, 0, framed, 2, query.size)
        out.write(framed)
        out.flush()
        val input = DataInputStream(socket.getInputStream())
        val length = input.readUnsignedShort()
        val reply = ByteArray(length)
        input.readFully(reply)
        if (!sameId(query, reply)) throw IOException("mismatched DNS reply")
        return reply
    }

    private fun sameId(query: ByteArray, reply: ByteArray) =
        reply.size >= 12 && reply[0] == query[0] && reply[1] == query[1]

    private fun closeQuietly(socket: Socket) {
        try { socket.close() } catch (_: Exception) {}
    }

    companion object {
        private const val TAG = "DisciplineAppDns"
        private const val UDP_TIMEOUT_MS = 2000
        private const val CONNECT_TIMEOUT_MS = 2500
        private const val STREAM_TIMEOUT_MS = 3000
        private const val FAILURE_COOLDOWN_MS = 30_000L
        private const val HOST_CACHE_MS = 10 * 60_000L
        private const val MAX_POOLED = 4
        private val FALLBACKS = listOf("1.1.1.1", "8.8.8.8", "9.9.9.9")

        private val IPV4 = Regex("""^\d{1,3}(\.\d{1,3}){3}$""")
        private val IPV6 = Regex("""^[0-9a-fA-F:.]+$""")
        /** Letters in the last label, so "1.2.3.999" is never taken for a hostname. */
        private val HOSTNAME = Regex("""^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z][a-z0-9-]{0,62}$""")

        /** True for well-formed IPv4/IPv6 literals; never does a lookup. */
        fun isIpLiteral(value: String): Boolean =
            (IPV4.matches(value) && value.split('.').all { it.toInt() <= 255 }) ||
                (value.contains(':') && IPV6.matches(value))
    }
}
