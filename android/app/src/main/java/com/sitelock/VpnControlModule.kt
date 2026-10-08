package com.sitelock

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.net.VpnService
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import com.facebook.react.bridge.ActivityEventListener
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableMap

/**
 * JS bridge for the DNS VPN layer.
 *
 *  - enable():  requests the one-time system VPN consent (if needed) and starts
 *               the DNS filter. Resolves true when filtering is on.
 *  - disable(): stops the filter.
 *  - isRunning(): current state.
 */
class VpnControlModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext), ActivityEventListener {

    private var pendingPromise: Promise? = null

    init {
        reactContext.addActivityEventListener(this)
    }

    override fun getName(): String = "VpnControl"

    @ReactMethod
    fun isRunning(promise: Promise) {
        promise.resolve(DnsVpnService.isRunning.get())
    }

    /** Live diagnostics for the status panel. */
    @ReactMethod
    fun getStats(promise: Promise) {
        val map: WritableMap = Arguments.createMap()
        map.putBoolean("running", DnsVpnService.isRunning.get())
        map.putInt("ruleCount", DnsVpnService.ruleCount)
        map.putInt("forwarded", DnsVpnService.forwardedCount.get())
        map.putInt("blocked", DnsVpnService.blockedCount.get())
        map.putInt("errors", DnsVpnService.errorCount.get())
        map.putString("lastBlocked", DnsVpnService.lastBlocked)
        map.putString("lastError", DnsVpnService.lastError)
        promise.resolve(map)
    }

    /** Ask for VPN consent if required, then start the DNS filter. */
    @ReactMethod
    fun enable(promise: Promise) {
        val activity = currentActivity
        if (activity == null) {
            promise.reject("no_activity", "App must be in the foreground to enable DNS protection.")
            return
        }

        val consent = try {
            VpnService.prepare(reactContext)
        } catch (e: Exception) {
            promise.reject("prepare_failed", e)
            return
        }

        if (consent != null) {
            // Consent dialog needed — launch it and finish in onActivityResult.
            pendingPromise = promise
            try {
                activity.startActivityForResult(consent, REQUEST_VPN)
            } catch (e: Exception) {
                pendingPromise = null
                promise.reject("consent_failed", e)
            }
        } else {
            // Already consented.
            DnsVpnService.start(reactContext)
            promise.resolve(true)
        }
    }

    @ReactMethod
    fun disable(promise: Promise) {
        DnsVpnService.stop(reactContext)
        promise.resolve(true)
    }

    /**
     * Opens Android's VPN settings, where the user can turn on "Always-on VPN"
     * and "Block connections without VPN" for Gaman. That makes the DNS filter
     * persistent, reboot-proof, and cuts off all internet when it's off — so it
     * can't be dropped with a couple of quick taps.
     */
    @ReactMethod
    fun openVpnSettings(promise: Promise) {
        try {
            val intent = Intent(Settings.ACTION_VPN_SETTINGS)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            (currentActivity ?: reactContext).startActivity(intent)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("vpn_settings_failed", e)
        }
    }

    /** Current upstream resolver ("" = system default). */
    @ReactMethod
    fun getUpstreamDns(promise: Promise) {
        val prefs = reactContext.getSharedPreferences("BlockedPrefs", Context.MODE_PRIVATE)
        promise.resolve(prefs.getString("@dns_upstream", "") ?: "")
    }

    /**
     * Set the upstream resolver for allowed lookups (e.g. AdGuard's 94.140.14.14),
     * or "" to use the system default. Restarts the filter so it takes effect.
     */
    @ReactMethod
    fun setUpstreamDns(ip: String, promise: Promise) {
        val prefs = reactContext.getSharedPreferences("BlockedPrefs", Context.MODE_PRIVATE)
        prefs.edit().putString("@dns_upstream", ip.trim()).apply()
        if (DnsVpnService.isRunning.get()) {
            DnsVpnService.stop(reactContext)
            Handler(Looper.getMainLooper()).postDelayed({ DnsVpnService.start(reactContext) }, 700)
        }
        promise.resolve(true)
    }

    /** Opens the Private DNS settings page (falls back to network settings). */
    @ReactMethod
    fun openPrivateDnsSettings(promise: Promise) {
        val actions = listOf(
            "android.settings.PRIVATE_DNS_SETTINGS",
            Settings.ACTION_WIRELESS_SETTINGS,
            Settings.ACTION_SETTINGS
        )
        for (action in actions) {
            try {
                val intent = Intent(action).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                (currentActivity ?: reactContext).startActivity(intent)
                promise.resolve(true)
                return
            } catch (_: Exception) { /* try next */ }
        }
        promise.reject("private_dns_failed", "Could not open settings")
    }

    // ---- ActivityEventListener ------------------------------------------

    override fun onActivityResult(activity: Activity?, requestCode: Int, resultCode: Int, data: Intent?) {
        if (requestCode != REQUEST_VPN) return
        val promise = pendingPromise ?: return
        pendingPromise = null

        if (resultCode == Activity.RESULT_OK) {
            DnsVpnService.start(reactContext)
            promise.resolve(true)
        } else {
            // User declined the VPN consent.
            promise.resolve(false)
        }
    }

    override fun onNewIntent(intent: Intent?) { /* no-op */ }

    companion object {
        private const val REQUEST_VPN = 0x5170 // arbitrary
    }
}
