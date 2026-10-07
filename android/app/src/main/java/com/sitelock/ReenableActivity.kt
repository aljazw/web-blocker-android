package com.sitelock

import android.app.Activity
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.view.WindowManager

/**
 * Shown the instant the accessibility service is disabled. Appears over the
 * lock screen and keeps the screen on so the user can't quietly leave the
 * protection off. The button drops them straight into Accessibility settings
 * to turn it back on.
 */
class ReenableActivity : Activity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        showWhenLockedAndTurnScreenOn()

        SiteLockScreen.show(
            this,
            SiteLockScreen.Spec(
                iconRes = R.drawable.ic_shield_alert,
                tone = SiteLockScreen.Tone.DANGER,
                eyebrow = "Protection is off",
                title = "Your blocks aren’t working",
                body = "SiteLock’s accessibility service was switched off, so blocked sites can load " +
                    "again. Turn it back on to restore them.",
                quote = "“Don’t trade what you want most for what you want right now.”",
                primaryLabel = "Turn protection back on",
                onPrimary = { openAccessibilitySettings() },
            ),
        )
    }

    private fun openAccessibilitySettings() {
        try {
            startActivity(
                android.content.Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS)
                    .addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK)
            )
        } catch (_: Exception) {
            startActivity(
                android.content.Intent(Settings.ACTION_SETTINGS)
                    .addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK)
            )
        }
        finish()
    }

    // Block the back button from silently dismissing the prompt.
    @Deprecated("Deprecated in Java")
    override fun onBackPressed() { /* intentionally no-op */ }

    private fun showWhenLockedAndTurnScreenOn() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true)
            setTurnScreenOn(true)
        } else {
            @Suppress("DEPRECATION")
            window.addFlags(
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
                    WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON or
                    WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
            )
        }
    }
}
