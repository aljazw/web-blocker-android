package com.gaman

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

    /** Opened by the in-app "Test" button, so it stays up even though protection is on. */
    private var isTest = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // Opened from an old notification after protection came back on: nothing to warn about.
        isTest = intent?.getBooleanExtra(EXTRA_TEST, false) == true
        if (!isTest && AccessibilityUtils.isServiceEnabled(this)) {
            WatchdogService.clearAlert(this)
            finish()
            return
        }
        current = java.lang.ref.WeakReference(this)

        showWhenLockedAndTurnScreenOn()

        GamanScreen.show(
            this,
            GamanScreen.Spec(
                iconRes = R.drawable.ic_shield_alert,
                tone = GamanScreen.Tone.DANGER,
                eyebrow = "Protection is off",
                title = "Your blocks aren’t working",
                body = "Gaman’s accessibility service was switched off, so blocked sites can load " +
                    "again. Turn it back on to restore them.",
                primaryLabel = "Turn protection back on",
                onPrimary = { openAccessibilitySettings() },
            ),
        )
    }

    override fun onResume() {
        super.onResume()
        if (!isTest && AccessibilityUtils.isServiceEnabled(this)) finish()
    }

    override fun onDestroy() {
        if (current?.get() === this) current = null
        super.onDestroy()
    }

    companion object {
        const val EXTRA_TEST = "test"
        private var current: java.lang.ref.WeakReference<ReenableActivity>? = null

        /** Closes the warning once protection is back on. */
        fun dismissIfShowing() {
            val activity = current?.get() ?: return
            activity.runOnUiThread { activity.finish() }
        }
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
