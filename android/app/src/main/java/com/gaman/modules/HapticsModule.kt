package com.gaman.modules

import android.os.Build
import android.view.HapticFeedbackConstants
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.UiThreadUtil

/**
 * System haptics (the same light ticks as the keyboard and system UI) instead
 * of raw vibration, which feels heavy. Respects the user's "touch feedback"
 * setting. Fire-and-forget: nothing to await.
 */
class HapticsModule(private val ctx: ReactApplicationContext) : ReactContextBaseJavaModule(ctx) {
    override fun getName(): String = "Haptics"

    @ReactMethod
    fun perform(kind: String) {
        val constant = when (kind) {
            "toggle" -> if (Build.VERSION.SDK_INT >= 34) HapticFeedbackConstants.TOGGLE_ON else HapticFeedbackConstants.CLOCK_TICK
            "success" -> if (Build.VERSION.SDK_INT >= 30) HapticFeedbackConstants.CONFIRM else HapticFeedbackConstants.LONG_PRESS
            "warning" -> if (Build.VERSION.SDK_INT >= 30) HapticFeedbackConstants.REJECT else HapticFeedbackConstants.LONG_PRESS
            else -> if (Build.VERSION.SDK_INT >= 27) HapticFeedbackConstants.KEYBOARD_PRESS else HapticFeedbackConstants.VIRTUAL_KEY
        }
        UiThreadUtil.runOnUiThread {
            ctx.currentActivity?.window?.decorView?.performHapticFeedback(constant)
        }
    }
}
