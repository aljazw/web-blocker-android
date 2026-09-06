package com.sitelock

import android.accessibilityservice.AccessibilityService
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.util.Log
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import java.time.LocalDate
import java.time.LocalTime
import java.time.format.DateTimeFormatter

class BlockAccessibilityService : AccessibilityService() {

    data class BlockedWebsite(
        val days: String,
        val time: String,
        val websiteUrl: String,
        val visible: Boolean
    )

    // Default to an empty list to avoid UninitializedPropertyAccessException crashes
    private var blockedList: List<BlockedWebsite> = emptyList()
    private lateinit var sharedPref: SharedPreferences

    private var lastProcessedTime: Long = 0
    private val debounceInterval = 500L

    private val prefsListener = SharedPreferences.OnSharedPreferenceChangeListener { _, key ->
        if (key == "@blocked_websites") {
            loadBlockedList()
        }
    }

    override fun onServiceConnected() {
        super.onServiceConnected()
        sharedPref = applicationContext.getSharedPreferences("BlockedPrefs", Context.MODE_PRIVATE)
        sharedPref.registerOnSharedPreferenceChangeListener(prefsListener)
        loadBlockedList()
    }

    override fun onDestroy() {
        super.onDestroy()
        if (::sharedPref.isInitialized) {
            sharedPref.unregisterOnSharedPreferenceChangeListener(prefsListener)
        }
    }

    private fun loadBlockedList() {
        val jsonData = sharedPref.getString("@blocked_websites", null) ?: return

        try {
            val gson = Gson()
            val type = object : TypeToken<List<BlockedWebsite>>() {}.type
            blockedList = gson.fromJson<List<BlockedWebsite>>(jsonData, type) ?: emptyList()
        } catch (e: Exception) {
            Log.e("BlockedService", "Failed to parse blocked list", e)
            blockedList = emptyList()
        }
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        if (event == null) return

        val packageName = event.packageName?.toString() ?: return
        val className = event.className?.toString() ?: "UnknownClass"

        Log.d("AccessibilityTracker", "Package: $packageName | Class/Screen: $className")

        val rootNode = rootInActiveWindow

        // 1. Check for Settings Toggle Screen (with safe null check for rootNode)
        if (rootNode != null && isInnerSiteLockToggleScreen(packageName, className, rootNode)) {
            if (System.currentTimeMillis() - lastProcessedTime >= debounceInterval) {
                lastProcessedTime = System.currentTimeMillis()
                startBlockedActivity("Settings", packageName)
            }
            return
        }

        // 2. Debounce browser evaluation
        if (System.currentTimeMillis() - lastProcessedTime < debounceInterval) {
            return
        }

        if (!isBrowser(packageName) || rootNode == null) return

        val currentDay = LocalDate.now().dayOfWeek.name.take(3).lowercase()
        val now = LocalTime.now()
        val formatter = DateTimeFormatter.ofPattern("HH:mm")
        val timePattern = Regex("""^\d{2}:\d{2}\s*-\s*\d{2}:\d{2}$""")

        for (item in blockedList) {
            val matchingNodes = rootNode.findAccessibilityNodeInfosByText(item.websiteUrl)
            if (matchingNodes.isNullOrEmpty()) continue

            val days: Set<String> = if (item.days == "Full Week") {
                setOf("mon", "tue", "wed", "thu", "fri", "sat", "sun")
            } else {
                item.days.split(",").map { it.trim().trim('\'').lowercase() }.toSet()
            }

            val isDayAllowed = currentDay in days

            var isWithinTimeRange = true
            if (!item.time.isNullOrEmpty()) {
                if (item.time.equals("All Day Long", ignoreCase = true)) {
                    isWithinTimeRange = true
                } else if (timePattern.matches(item.time)) {
                    val (startStr, endStr) = item.time.split(" - ").map { it.trim() }
                    val startTime = LocalTime.parse(startStr, formatter)
                    val endTime = LocalTime.parse(endStr, formatter)

                    isWithinTimeRange = if (startTime <= endTime) {
                        now.isAfter(startTime) && now.isBefore(endTime)
                    } else {
                        now.isAfter(startTime) || now.isBefore(endTime)
                    }
                } else {
                    isWithinTimeRange = true
                }
            }

            if (isDayAllowed && isWithinTimeRange) {
                val validNode = matchingNodes.any { node -> 
                    node.className == "android.widget.EditText" && !node.isFocused 
                }

                if (validNode) {                   
                    lastProcessedTime = System.currentTimeMillis()
                    startBlockedActivity(item.websiteUrl, packageName)
                    break
                }
            }
        }
    }

    override fun onInterrupt() {
        // Handle service interruption if needed
    }

    private fun isBrowser(packageName: String?): Boolean {
        if (packageName == null) return false

        val browserPackages = setOf(
            "com.android.chrome",
            "org.mozilla.firefox",
            "com.brave.browser",
            "com.opera.browser"
        )

        return packageName in browserPackages
    }

    private fun startBlockedActivity(url: String, packageName: String) {
        val intent = Intent()
        intent.setClassName("com.sitelock", "com.sitelock.BlockedPageActivity")
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        intent.putExtra("blocked_url", url)
        intent.putExtra("package_name", packageName)
        applicationContext.startActivity(intent)
    }

    private fun isInnerSiteLockToggleScreen(
        packageName: String, 
        className: String, 
        rootNode: AccessibilityNodeInfo?
    ): Boolean {
        if (rootNode == null) return false
        if (packageName != "com.android.settings") return false

        // 1. On main list pages, "SiteLock" appears as a simple list item / preference.
        // We check if the screen actually contains the top switch bar or switch widget container.
        val switchWidget = rootNode.findAccessibilityNodeInfosByViewId("android:id/switch_widget")
        val switchBar = rootNode.findAccessibilityNodeInfosByViewId("com.android.settings:id/switch_bar")
        val mainSwitchBar = rootNode.findAccessibilityNodeInfosByViewId("com.android.settings:id/main_switch_bar")

        val hasActualSwitchWidget = !switchWidget.isNullOrEmpty() || 
                                    !switchBar.isNullOrEmpty() || 
                                    !mainSwitchBar.isNullOrEmpty()

        if (!hasActualSwitchWidget) {
            return false // If there's no top switch container, it's definitely just a list page
        }

        // 2. Look for text elements that only exist inside the detail page
        val hasUseServiceText = !rootNode.findAccessibilityNodeInfosByText("Use SiteLock").isNullOrEmpty()
        val hasShortcutText = !rootNode.findAccessibilityNodeInfosByText("SiteLock shortcut").isNullOrEmpty()
        val hasControlText = !rootNode.findAccessibilityNodeInfosByText("full control").isNullOrEmpty()

        // 3. Ensure "SiteLock" is present
        val hasSiteLockText = !rootNode.findAccessibilityNodeInfosByText("SiteLock").isNullOrEmpty()

        // It's the inner page if we have a real switch AND (specific toggle text OR SiteLock title)
        return hasSiteLockText && (hasUseServiceText || hasShortcutText || hasControlText)
    }
}
