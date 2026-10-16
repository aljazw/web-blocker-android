package com.disciplineapp

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.provider.Browser   // for EXTRA_APPLICATION_ID

class BlockedPageActivity : Activity() {
    companion object {
        /** Set when the block is a used-up daily limit rather than a plain block. */
        const val EXTRA_LIMIT_MINUTES = "limit_minutes"
    }

    /** Why it's blocked: the day's allowance is gone, or it's simply on the list right now. */
    private fun reason(what: String): String {
        val limit = intent.getIntExtra(EXTRA_LIMIT_MINUTES, 0)
        if (limit <= 0) return "This $what is on your block list right now."
        val h = limit / 60
        val m = limit % 60
        val amount = when {
            h == 0 -> "$m min"
            m == 0 -> "$h h"
            else -> "$h h $m min"
        }
        return "You've used your $amount for today. It opens again tomorrow."
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val blockedApp = intent.getStringExtra("blocked_app_name")
        if (blockedApp != null) {
            showAppBlocked(blockedApp)
            return
        }

        val blockedUrl = intent.getStringExtra("blocked_url") ?: "This site"
        val packageName = intent.getStringExtra("package_name") ?: "com.android.chrome"

        AppScreen.show(
            this,
            AppScreen.Spec(
                iconRes = R.drawable.ic_ban,
                tone = AppScreen.Tone.DANGER,
                eyebrow = "Blocked by $appName",
                title = blockedUrl,
                body = reason("site"),
                primaryLabel = "Go back",
                onPrimary = { leave(packageName) },
            ),
        )
    }

    /** Block page for an app: the only way out is the home screen. */
    private fun showAppBlocked(blockedApp: String) {
        appBlocked = true
        AppScreen.show(
            this,
            AppScreen.Spec(
                iconRes = R.drawable.ic_ban,
                tone = AppScreen.Tone.DANGER,
                eyebrow = "Blocked by $appName",
                title = blockedApp,
                body = reason("app"),
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
