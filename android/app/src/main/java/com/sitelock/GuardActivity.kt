package com.sitelock

import android.app.Activity
import android.os.Build
import android.os.Bundle
import android.view.WindowManager

/**
 * Shown when the user reaches Gaman's accessibility on/off page while the
 * service is active. Explains that they can't disable it here and sends them
 * away. Appears over the lock screen and keeps the screen on.
 */
class GuardActivity : Activity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        showWhenLockedAndTurnScreenOn()

        SiteLockScreen.show(
            this,
            SiteLockScreen.Spec(
                iconRes = R.drawable.ic_shield_check,
                tone = SiteLockScreen.Tone.ACCENT,
                eyebrow = "Protection is locked",
                title = "Stay on track",
                body = "You’re trying to turn Gaman’s protection off while a block is active. " +
                    "That’s exactly the moment to keep it on, so this page is off-limits right now.",
                primaryLabel = "OK, keep me focused",
                onPrimary = { goHome() },
            ),
        )
    }

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() { goHome() }

    /** Leave to the launcher so dismissing never drops back on the toggle page. */
    private fun goHome() {
        try {
            startActivity(
                android.content.Intent(android.content.Intent.ACTION_MAIN).apply {
                    addCategory(android.content.Intent.CATEGORY_HOME)
                    addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK)
                }
            )
        } catch (_: Exception) { /* ignore */ }
        finish()
    }

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
