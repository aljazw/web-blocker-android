package com.sitelock

import android.app.Activity
import android.os.Bundle
import android.content.Intent
import android.net.Uri
import android.graphics.Color
import android.graphics.Typeface
import android.widget.LinearLayout
import android.view.Gravity
import android.widget.Button
import android.widget.TextView
import android.graphics.drawable.GradientDrawable


class BlockedPageActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

         // Create a parent layout to center everything
        val layout = LinearLayout(this)
        layout.orientation = LinearLayout.VERTICAL
        layout.gravity = Gravity.CENTER
        layout.setPadding(32, 100, 32, 32)

        val blockedUrl = intent.getStringExtra("blocked_url") ?: "This site"

        // Main message
        val titleText = TextView(this).apply {
            text = "Access to \"$blockedUrl\" is blocked!"
            textSize = 22f
            gravity = Gravity.CENTER
            setTextColor(Color.RED)
            setTypeface(null, Typeface.BOLD)
        }

        // Motivational quote
        val quoteText = TextView(this).apply {
            text = "\n“Don’t trade what you want most for what you want right now.”\n\n"
            textSize = 18f
            gravity = Gravity.CENTER
            setTextColor(Color.parseColor("#FFEB3B"))
        }

        val goBackButton = Button(this).apply {
            text = "Go Back"
            textSize = 16f
            setTextColor(Color.WHITE)
            setBackgroundColor(Color.parseColor("#1976D2")) // Blue color
            setPadding(40, 20, 40, 20) // (left, top, right, bottom)

            // Optional: Give it a rounded corner background (for API 21+)
            background = GradientDrawable().apply {
                cornerRadius = 24f
                setColor(Color.parseColor("#1976D2"))
            }

            // Set margin via LayoutParams (you must add it after this is attached to a parent)
            val params = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply {
                topMargin = 50
            }
            layoutParams = params

            setOnClickListener {
                val homeIntent = Intent(Intent.ACTION_VIEW, Uri.parse("https://www.google.com"))
                homeIntent.flags = Intent.FLAG_ACTIVITY_NEW_TASK
                startActivity(homeIntent)
                finish()
            }
        }

        layout.addView(titleText)
        layout.addView(quoteText)
        layout.addView(goBackButton)


        setContentView(layout)
    }
}
