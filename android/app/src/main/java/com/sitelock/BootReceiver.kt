package com.sitelock

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.net.VpnService

/**
 * Restarts the protection layers after a reboot or an app update.
 *
 *  - Watchdog: restarted only if the accessibility service is still enabled, so
 *    we never nag a user who legitimately turned Gaman off.
 *  - DNS VPN: restarted only if it was on AND consent is still granted
 *    (VpnService.prepare returns null when already consented).
 *
 * Note: Android will NOT deliver these broadcasts after a manual "Force stop"
 * until the app is opened again — an OS guarantee no ordinary app can bypass
 * without Device Owner privileges.
 */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent?) {
        when (intent?.action) {
            Intent.ACTION_BOOT_COMPLETED,
            Intent.ACTION_LOCKED_BOOT_COMPLETED,
            Intent.ACTION_MY_PACKAGE_REPLACED -> {
                if (AccessibilityUtils.isServiceEnabled(context)) {
                    WatchdogService.ensureRunning(context)
                }
                if (dnsWasEnabled(context) && VpnService.prepare(context) == null) {
                    DnsVpnService.start(context)
                }
            }
        }
    }

    private fun dnsWasEnabled(context: Context): Boolean {
        val prefs = context.getSharedPreferences("BlockedPrefs", Context.MODE_PRIVATE)
        return prefs.getString("@dns_enabled", "false") == "true"
    }
}
