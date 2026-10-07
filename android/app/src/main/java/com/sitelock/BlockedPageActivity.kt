package com.sitelock

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.provider.Browser   // for EXTRA_APPLICATION_ID

class BlockedPageActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val blockedUrl = intent.getStringExtra("blocked_url") ?: "This site"
        val packageName = intent.getStringExtra("package_name") ?: "com.android.chrome"

        SiteLockScreen.show(
            this,
            SiteLockScreen.Spec(
                iconRes = R.drawable.ic_ban,
                tone = SiteLockScreen.Tone.DANGER,
                eyebrow = "Blocked by SiteLock",
                title = blockedUrl,
                body = "This site is on your block list right now.",
                quote = "“Don’t trade what you want most for what you want right now.”",
                primaryLabel = "Go back",
                onPrimary = { leave(packageName) },
            ),
        )
    }

    private fun leave(packageName: String) {
        try {
            val intent = Intent(Intent.ACTION_VIEW, Uri.parse("https://www.google.com")).apply {
                setPackage(packageName)
                addFlags(
                    Intent.FLAG_ACTIVITY_NEW_TASK or
                        Intent.FLAG_ACTIVITY_CLEAR_TASK or
                        Intent.FLAG_ACTIVITY_CLEAR_TOP
                )
                putExtra(Browser.EXTRA_APPLICATION_ID, packageName)
            }
            startActivity(intent)
        } catch (e: Exception) {
            // Fallback: If opening the specific browser package fails, open default browser or go Home
            val homeIntent = Intent(Intent.ACTION_MAIN).apply {
                addCategory(Intent.CATEGORY_HOME)
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            startActivity(homeIntent)
        }

        finish()
    }
}
