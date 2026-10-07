package com.sitelock

import android.app.Activity
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.os.Bundle
import android.view.Gravity
import android.view.WindowManager
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView

/**
 * Shown when the user reaches SiteLock's accessibility on/off page while the
 * service is active. Explains that they can't disable it here and sends them
 * away. Appears over the lock screen and keeps the screen on.
 */
class GuardActivity : Activity() {

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
            text = "Stay on track"
            textSize = 24f
            gravity = Gravity.CENTER
            setTextColor(Color.parseColor("#FFEB3B"))
            setTypeface(null, Typeface.BOLD)
        }

        val body = TextView(this).apply {
            text = "\nYou’re trying to turn SiteLock’s protection off while a block is active.\n\n" +
                "That’s exactly the moment to keep it on. This page is off-limits right now.\n"
            textSize = 17f
            gravity = Gravity.CENTER
            setTextColor(Color.parseColor("#E0E0E0"))
        }

        val okBtn = Button(this).apply {
            text = "OK, keep me focused"
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
            setOnClickListener { goHome() }
        }

        layout.addView(title)
        layout.addView(body)
        layout.addView(okBtn)
        setContentView(layout)
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
