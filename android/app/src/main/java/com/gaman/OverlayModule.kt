package com.gaman

import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

/**
 * "Display over other apps" (SYSTEM_ALERT_WINDOW) permission bridge.
 *
 * This permission is what lets the watchdog pop its "turn protection back on"
 * screen from the background the instant the accessibility service is disabled.
 * Without it, Android silently blocks that background screen and the watchdog
 * appears to "do nothing".
 */
class OverlayModule(private val ctx: ReactApplicationContext) :
    ReactContextBaseJavaModule(ctx) {

    override fun getName(): String = "OverlayPermission"

    @ReactMethod
    fun canDrawOverlays(promise: Promise) {
        val ok = Build.VERSION.SDK_INT < Build.VERSION_CODES.M || Settings.canDrawOverlays(ctx)
        promise.resolve(ok)
    }

    /** Opens the system screen where the user grants the permission. */
    @ReactMethod
    fun requestOverlayPermission(promise: Promise) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M || Settings.canDrawOverlays(ctx)) {
            promise.resolve(true)
            return
        }
        val intent = Intent(
            Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
            Uri.parse("package:${ctx.packageName}")
        ).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        try {
            (currentActivity ?: ctx).startActivity(intent)
            promise.resolve(true) // opened the screen; JS re-checks on resume
        } catch (e: Exception) {
            promise.reject("overlay_failed", e)
        }
    }
}
