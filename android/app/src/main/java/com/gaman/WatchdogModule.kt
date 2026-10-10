package com.gaman

import android.content.Intent
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

/** Status + test hooks for the accessibility watchdog. */
class WatchdogModule(private val ctx: ReactApplicationContext) :
    ReactContextBaseJavaModule(ctx) {

    override fun getName(): String = "Watchdog"

    @ReactMethod
    fun isRunning(promise: Promise) {
        promise.resolve(WatchdogService.isRunning.get())
    }

    /**
     * Launches the re-enable warning screen now, so the user can confirm the
     * screen actually appears (verifies the overlay + activity path). Launched
     * from the foreground app, so it works regardless of background-launch rules.
     */
    @ReactMethod
    fun testWarning(promise: Promise) {
        try {
            val intent = Intent(ctx, ReenableActivity::class.java)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)
                .putExtra(ReenableActivity.EXTRA_TEST, true)
            (currentActivity ?: ctx).startActivity(intent)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("test_failed", e)
        }
    }
}
