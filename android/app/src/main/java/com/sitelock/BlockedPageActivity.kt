package com.sitelock

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.provider.Browser   // for EXTRA_APPLICATION_ID

class BlockedPageActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val blockedApp = intent.getStringExtra("blocked_app_name")
        if (blockedApp != null) {
            showAppBlocked(blockedApp)
            return
        }

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
                primaryLabel = "Go back",
                onPrimary = { leave(packageName) },
            ),
        )
    }

    /** Block page for an app: the only way out is the home screen. */
    private fun showAppBlocked(appName: String) {
        appBlocked = true
        SiteLockScreen.show(
            this,
            SiteLockScreen.Spec(
                iconRes = R.drawable.ic_ban,
                tone = SiteLockScreen.Tone.DANGER,
                eyebrow = "Blocked by SiteLock",
                title = appName,
                body = "This app is on your block list right now.",
                primaryLabel = "Go to home screen",
                onPrimary = { goHome() },
            ),
        )
    }

    private var appBlocked = false

    // Back must not drop the user into the blocked app.
    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        if (appBlocked) goHome() else @Suppress("DEPRECATION") super.onBackPressed()
    }

    private fun goHome() {
        startActivity(Intent(Intent.ACTION_MAIN).apply {
            addCategory(Intent.CATEGORY_HOME)
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        })
        finish()
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
