package com.sitelock.modules

import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.drawable.BitmapDrawable
import android.graphics.drawable.Drawable
import android.util.Base64
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.io.ByteArrayOutputStream
import java.util.concurrent.Executors

/**
 * Lists the apps the user can launch (so they can pick which ones to block)
 * and returns app icons as small base64 PNGs for the UI.
 */
class InstalledAppsModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    private val executor = Executors.newSingleThreadExecutor()

    override fun getName(): String = "InstalledApps"

    /** Resolves to [{ packageName, label }], sorted by label. Excludes SiteLock itself. */
    @ReactMethod
    fun getLaunchableApps(promise: Promise) {
        executor.execute {
            try {
                val pm = reactContext.packageManager
                val launcher = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER)
                val apps = pm.queryIntentActivities(launcher, 0)
                    .map { it.activityInfo.packageName to it.loadLabel(pm).toString() }
                    .filter { (pkg, _) -> pkg != reactContext.packageName && !isProtected(pkg) }
                    .distinctBy { it.first }
                    .sortedBy { it.second.lowercase() }

                val result = Arguments.createArray()
                apps.forEach { (pkg, label) ->
                    result.pushMap(Arguments.createMap().apply {
                        putString("packageName", pkg)
                        putString("label", label)
                    })
                }
                promise.resolve(result)
            } catch (e: Exception) {
                promise.reject("APPS_ERROR", "Failed to list installed apps", e)
            }
        }
    }

    /** Resolves to a data: URI of the app's icon (96px PNG), or null if not installed. */
    @ReactMethod
    fun getAppIcon(packageName: String, promise: Promise) {
        executor.execute {
            try {
                val drawable = reactContext.packageManager.getApplicationIcon(packageName)
                promise.resolve("data:image/png;base64," + encode(drawable, 96))
            } catch (e: Exception) {
                promise.resolve(null)
            }
        }
    }

    /**
     * Apps that must never be blocked: Settings (the accessibility service treats
     * it separately) and the phone dialer, so emergency calls always work.
     */
    private fun isProtected(pkg: String): Boolean =
        pkg.contains("settings", ignoreCase = true) ||
            pkg.contains("dialer", ignoreCase = true) ||
            pkg == "com.android.phone" ||
            pkg.contains("emergency", ignoreCase = true)

    private fun encode(drawable: Drawable, size: Int): String {
        val bitmap = if (drawable is BitmapDrawable && drawable.bitmap != null) {
            Bitmap.createScaledBitmap(drawable.bitmap, size, size, true)
        } else {
            // Adaptive / vector icons: draw them onto a bitmap.
            Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888).also {
                val canvas = Canvas(it)
                drawable.setBounds(0, 0, size, size)
                drawable.draw(canvas)
            }
        }
        val out = ByteArrayOutputStream()
        bitmap.compress(Bitmap.CompressFormat.PNG, 100, out)
        return Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP)
    }
}
