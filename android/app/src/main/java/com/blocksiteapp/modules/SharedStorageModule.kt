package com.blocksiteapp.modules

import android.content.Context
import android.content.SharedPreferences
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Promise

class SharedStorageModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
    private val prefs: SharedPreferences = reactContext.getSharedPreferences("BlockedPrefs", Context.MODE_PRIVATE)
    
    override fun getName(): String = "SharedStorage"

    @ReactMethod
    fun setItem(key: String, value: String, promise: Promise) {
        prefs.edit().putString(key, value).apply()
        promise.resolve(true)
    }

    @ReactMethod
    fun getItem(key: String, promise: Promise) {
        val value = prefs.getString(key, null)
        promise.resolve(value)
    }
}