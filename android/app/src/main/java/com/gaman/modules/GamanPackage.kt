package com.gaman.modules

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager
import com.gaman.OverlayModule
import com.gaman.VpnControlModule
import com.gaman.WatchdogModule
import com.gaman.apnea.ApneaModule

/** Registers every native module of the app. Add new modules to this list. */
class GamanPackage : ReactPackage {
    override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> =
        listOf(
            SharedStorageModule(reactContext),
            AccessibilityStatusModule(reactContext),
            IntentLauncherModule(reactContext),
            DeviceAdminModule(reactContext),
            VpnControlModule(reactContext),
            OverlayModule(reactContext),
            WatchdogModule(reactContext),
            InstalledAppsModule(reactContext),
            ApneaModule(reactContext),
            HapticsModule(reactContext),
        )

    override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> = emptyList()
}
