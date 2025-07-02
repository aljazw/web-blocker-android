package com.sitelock

import android.app.Activity
import android.content.Intent
import android.os.Bundle
import android.provider.Settings

class OpenAccessibilityActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val intent = Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS)
        intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK
        startActivity(intent)

        finish()
    }
}
