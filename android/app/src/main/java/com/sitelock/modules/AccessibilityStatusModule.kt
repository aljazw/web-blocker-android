package com.sitelock.modules

import android.content.ComponentName
import android.content.Context
import android.provider.Settings
import android.text.TextUtils
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Promise

import android.util.Log
import com.sitelock.BlockAccessibilityService

class AccessibilityStatusModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String {
        return "AccessibilityStatus"
    }

    @ReactMethod
    fun isAccessibilityServiceEnabled(promise: Promise) {
        try {
            val context: Context = reactContext.applicationContext

            val expectedComponentName = ComponentName(context, BlockAccessibilityService::class.java)

            val enabledServicesSetting = Settings.Secure.getString(
                context.contentResolver,
                Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES
            )
            
            // Log.e("Accessibility", "Accessibility enabled services: $enabledServicesSetting")

            val colonSplitter = TextUtils.SimpleStringSplitter(':')
            colonSplitter.setString(enabledServicesSetting ?: "")

            for (service in colonSplitter) {
                val componentName = ComponentName.unflattenFromString(service)
                if (componentName != null && componentName == expectedComponentName) {
                    promise.resolve(true)
                    return
                }
            }

            promise.resolve(false)
        } catch (e: Exception) {
            promise.reject("ERROR_ACCESSIBILITY_STATUS", e.message, e)
        }
    }
}
