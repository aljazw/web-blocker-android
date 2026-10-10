package com.gaman.modules

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Promise

import com.gaman.AccessibilityUtils

class AccessibilityStatusModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String {
        return "AccessibilityStatus"
    }

    @ReactMethod
    fun isAccessibilityServiceEnabled(promise: Promise) {
        try {
            promise.resolve(AccessibilityUtils.isServiceEnabled(reactContext.applicationContext))
        } catch (e: Exception) {
            promise.reject("ERROR_ACCESSIBILITY_STATUS", e.message, e)
        }
    }
}
