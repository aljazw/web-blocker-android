package com.sitelock

import android.accessibilityservice.AccessibilityService
import android.view.accessibility.AccessibilityEvent
import android.content.Intent
import android.util.Log
import android.view.accessibility.AccessibilityNodeInfo
import android.content.Context
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import java.time.LocalTime
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import android.content.SharedPreferences


class BlockAccessibilityService : AccessibilityService() {

    data class BlockedWebsite(
        val days: String,
        val time: String,
        val websiteUrl: String,
        val visible: Boolean
    )

    private lateinit var blockedList: List<BlockedWebsite>
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
        sharedPref.unregisterOnSharedPreferenceChangeListener(prefsListener)
    }

    private fun loadBlockedList() {
        val jsonData = sharedPref.getString("@blocked_websites", null)

        if (jsonData != null) {
            try {
                val gson = Gson()
                val type = object : TypeToken<List<BlockedWebsite>>() {}.type
                blockedList = gson.fromJson(jsonData, type)
            } catch (e: Exception) {
                Log.e("BlockedService", "Failed to parse blocked list", e)
            }
        }
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {

        if (event == null) return

        if (System.currentTimeMillis() - lastProcessedTime < debounceInterval) {
            return
        }
        lastProcessedTime = System.currentTimeMillis()

        val packageName = event?.packageName?.toString() ?: return

        if (!isBrowser(packageName)) return

        val rootNode = rootInActiveWindow ?: return

        val currentDay = java.time.LocalDate.now().dayOfWeek.name.take(3).lowercase()
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
                // Optionally, check if any matching node is an EditText and not focused
                val validNode = matchingNodes.any { node -> 
                    node.className == "android.widget.EditText" && !node.isFocused 
                }

                if (validNode) {                   
                    startBlockedActivity(item.websiteUrl, packageName ?: "")
                    break
                }
            }
        }
    }

    override fun onInterrupt() {
    // You can leave this empty if you don't need to handle interruptions
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

}


    