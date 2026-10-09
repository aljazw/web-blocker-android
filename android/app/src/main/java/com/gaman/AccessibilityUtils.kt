package com.gaman

import android.content.ComponentName
import android.content.Context
import android.provider.Settings
import android.text.TextUtils

/**
 * Single source of truth for "is our accessibility service enabled?".
 *
 * Instead of parsing the Settings UI (which is worded/laid-out differently on
 * every OEM and in every language), we read the framework's own canonical
 * setting: Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES. That string is a
 * ':'-separated list of enabled service component names and is identical on
 * Samsung, Xiaomi, Pixel, etc. This is what makes detection device-independent.
 */
object AccessibilityUtils {

    fun serviceComponent(context: Context): ComponentName =
        ComponentName(context.applicationContext, BlockAccessibilityService::class.java)

    fun isServiceEnabled(context: Context): Boolean {
        val expected = serviceComponent(context)

        // Fast path: the global on/off flag. If accessibility is entirely off,
        // our service can't be running.
        val accessibilityOn = try {
            Settings.Secure.getInt(
                context.contentResolver,
                Settings.Secure.ACCESSIBILITY_ENABLED
            )
        } catch (e: Settings.SettingNotFoundException) {
            0
        }
        if (accessibilityOn == 0) return false

        val enabled = Settings.Secure.getString(
            context.contentResolver,
            Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES
        ) ?: return false

        val splitter = TextUtils.SimpleStringSplitter(':')
        splitter.setString(enabled)
        while (splitter.hasNext()) {
            val entry = splitter.next()
            val cn = ComponentName.unflattenFromString(entry) ?: continue
            // unflattenFromString expands the short "pkg/.Class" form, so an exact
            // match is enough. It also rejects the pre-rename com.sitelock.* class,
            // which Android may still list but can no longer bind.
            if (cn == expected) return true
        }
        return false
    }
}
