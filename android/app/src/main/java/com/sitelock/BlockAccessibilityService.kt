package com.sitelock

import android.accessibilityservice.AccessibilityService
import android.view.accessibility.AccessibilityEvent
import android.content.Intent
import android.net.Uri
import android.util.Log
import android.view.accessibility.AccessibilityNodeInfo
import java.util.concurrent.atomic.AtomicBoolean
import android.content.Context
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import java.time.LocalTime
import java.time.LocalDate
import java.time.format.DateTimeFormatter



class BlockAccessibilityService : AccessibilityService() {

    data class BlockedWebsite(
        val days: String,
        val time: String,
        val websiteUrl: String,
        val visible: Boolean
    )

    private lateinit var blockedList: List<BlockedWebsite>

    private fun loadBlockedList() {
        val sharedPref = applicationContext.getSharedPreferences("BlockedPrefs", Context.MODE_PRIVATE)
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

    private var lastProcessedTime: Long = 0
    private val debounceInterval = 1000L

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {

        if (System.currentTimeMillis() - lastProcessedTime < debounceInterval) {
            return
        }
        lastProcessedTime = System.currentTimeMillis()

        val packageName = event?.packageName?.toString()

        if (!isBrowser(packageName)) {
            return
        }

        // Log.d("BlockedSite", "Browser detected: $packageName")
        loadBlockedList()

        val rootNode = rootInActiveWindow
        if (rootNode != null) {
            var foundFirstEditText = AtomicBoolean(false)
            traverseNode(rootNode, foundFirstEditText)  
        }
    }

    override fun onInterrupt() {
    // You can leave this empty if you don't need to handle interruptions
    }

    private fun isBrowser(packageName: String?): Boolean {
        if (packageName == null) return false

        val browserPackages = listOf(
            "com.android.chrome",
            "org.mozilla.firefox",
            "com.brave.browser",
            "com.opera.browser",
        )

        return browserPackages.contains(packageName)
    }

    private fun startBlockedActivity(url: String) {
        val intent = Intent()
        intent.setClassName("com.sitelock", "com.sitelock.BlockedPageActivity")
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        intent.putExtra("blocked_url", url)
        applicationContext.startActivity(intent)
    }


    private fun traverseNode(node: AccessibilityNodeInfo?, foundFirstEditText: AtomicBoolean) {
        if (node == null || foundFirstEditText.get()) return 
        
        val currentDay = java.time.LocalDate.now().dayOfWeek.name.take(3).lowercase()
        val now = LocalTime.now()

        val formatter = DateTimeFormatter.ofPattern("HH:mm")
        val timePattern = Regex("""^\d{2}:\d{2}\s*-\s*\d{2}:\d{2}$""")

        if(node.className == "android.widget.EditText" && !node.isFocused){
            foundFirstEditText.set(true)
            for (item in blockedList) {
                if (node.text?.contains(item.websiteUrl) == true) {

                    val days: Array<String> = if (item.days == "Full Week") {
                        arrayOf("mon", "tue", "wed", "thu", "fri", "sat", "sun")
                    } else {
                        item.days
                            .split(",")                      
                            .map { it.trim().trim('\'').lowercase() }
                            .toTypedArray()              
                    }

                    if (item.time != null && timePattern.matches(item.time)) {
                        val timeRange = item.time
                        val parts = timeRange.split(" - ")
                        val startTime = LocalTime.parse(parts[0].trim(), formatter)
                        val endTime = LocalTime.parse(parts[1].trim(), formatter)

                         val isWithinTimeRange = if (startTime <= endTime) {
                            // Normal range (same day)
                            now.isAfter(startTime) && now.isBefore(endTime)
                        } else {
                            // Range crosses midnight
                            now.isAfter(startTime) || now.isBefore(endTime)
                        }

                        if (currentDay in days && isWithinTimeRange) {
                            startBlockedActivity(item.websiteUrl)
                            break
                        }

                        if (currentDay in (days) && isWithinTimeRange) {
                            startBlockedActivity(item.websiteUrl)
                            break
                        }
                    } else {
                        if (currentDay in (days)) {
                            // Log.d("BlockedSite", "Node: ${node.className}, Text: ${node.text}")
                            startBlockedActivity(item.websiteUrl)
                            break
                        }
                    }
                }
            }
        } 
        for (i in 0 until node.childCount) {
            traverseNode(node.getChild(i), foundFirstEditText)
        }
    }
}

