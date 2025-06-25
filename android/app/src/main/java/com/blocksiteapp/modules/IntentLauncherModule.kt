package com.blocksiteapp.modules

import android.content.Intent
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class IntentLauncherModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String {
        return "IntentLauncher"
    }

    @ReactMethod
    fun startActivity(activityName: String) {
        val context = reactApplicationContext
        try {
            val intent = Intent()
            intent.setClassName(context.packageName, activityName)
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            context.startActivity(intent)
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }
}
