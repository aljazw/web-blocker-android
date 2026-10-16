package com.disciplineapp.alarm

import android.app.NotificationManager
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

/** JS bridge: re-arm the alarm after its settings change, and the lock-screen permission. */
class WakeAlarmModule(private val ctx: ReactApplicationContext) : ReactContextBaseJavaModule(ctx) {

    override fun getName(): String = "WakeAlarm"

    @ReactMethod
    fun reschedule(promise: Promise) {
        WakeAlarm.schedule(ctx)
        promise.resolve(true)
    }

    /** Android 14+ may deny full-screen alerts; without them the alarm is only a notification. */
    @ReactMethod
    fun canShowOverLockScreen(promise: Promise) {
        val allowed = Build.VERSION.SDK_INT < Build.VERSION_CODES.UPSIDE_DOWN_CAKE ||
            ctx.getSystemService(NotificationManager::class.java).canUseFullScreenIntent()
        promise.resolve(allowed)
    }

    @ReactMethod
    fun openLockScreenSettings() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.UPSIDE_DOWN_CAKE) return
        try {
            ctx.startActivity(
                Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT, Uri.parse("package:${ctx.packageName}"))
                    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
            )
        } catch (_: Exception) { }
    }
}
