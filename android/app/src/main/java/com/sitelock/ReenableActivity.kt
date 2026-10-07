package com.sitelock

import android.app.Activity
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.view.Gravity
import android.view.WindowManager
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView

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

        val layout = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setBackgroundColor(Color.parseColor("#101418"))
            setPadding(48, 120, 48, 48)
        }

        val title = TextView(this).apply {
            text = "Protection was turned off"
            textSize = 24f
            gravity = Gravity.CENTER
            setTextColor(Color.parseColor("#FF5252"))
            setTypeface(null, Typeface.BOLD)
        }

        val body = TextView(this).apply {
            text = "\nSiteLock's accessibility service is off, so your blocks are " +
                "not working right now.\n\n" +
                "“Don’t trade what you want most for what you want right now.”\n\n" +
                "Turn it back on to restore your blocks.\n"
            textSize = 17f
            gravity = Gravity.CENTER
            setTextColor(Color.parseColor("#E0E0E0"))
        }

        val reenableBtn = Button(this).apply {
            text = "Turn protection back on"
            textSize = 16f
            setTextColor(Color.WHITE)
            setPadding(48, 28, 48, 28)
            background = GradientDrawable().apply {
                cornerRadius = 28f
                setColor(Color.parseColor("#1976D2"))
            }
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply { topMargin = 56 }
            setOnClickListener { openAccessibilitySettings() }
        }

        layout.addView(title)
        layout.addView(body)
        layout.addView(reenableBtn)
        setContentView(layout)
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
