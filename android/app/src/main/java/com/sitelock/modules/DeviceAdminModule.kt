package com.sitelock.modules

import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import android.content.Context
import com.sitelock.MyDeviceAdminReceiver
import android.content.Intent
import android.app.Activity
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.*



class DeviceAdminModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    private val context: Context = reactContext

    override fun getName(): String = "DeviceAdminModule"

    @ReactMethod
    fun isAdminEnabled(promise: Promise) {
        val dpm = context.getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
        val componentName = ComponentName(context, MyDeviceAdminReceiver::class.java)
        val isActive = dpm.isAdminActive(componentName)
        promise.resolve(isActive)
    }

    @ReactMethod
    fun toggleAdmin(promise: Promise) {
        val activity = currentActivity ?: run {
            promise.reject("E_ACTIVITY_NULL", "Activity is null")
            return
        }

        val adminComponent = ComponentName(activity, MyDeviceAdminReceiver::class.java)
        val dpm = activity.getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager


        val isAdmin = dpm.isAdminActive(adminComponent)

        if (isAdmin) {
            dpm.removeActiveAdmin(adminComponent)
            promise.resolve(false)
            return
        } 

        val intent = Intent(DevicePolicyManager.ACTION_ADD_DEVICE_ADMIN).apply {
            putExtra(DevicePolicyManager.EXTRA_DEVICE_ADMIN, adminComponent)
            putExtra(
                DevicePolicyManager.EXTRA_ADD_EXPLANATION,
                "Enable device admin to secure your app."
            )
        }

        try {
            activity.startActivity(intent)
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("E_ADMIN_LAUNCH_FAILED", e.message)
        }

    }

}
