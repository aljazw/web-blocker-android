package com.blocksiteapp

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


    private fun traverseNode(node: AccessibilityNodeInfo?, foundFirstEditText: AtomicBoolean) {
        if (node == null || foundFirstEditText.get()) return 
        

        if(node.className == "android.widget.EditText" && !node.isFocused){
            foundFirstEditText.set(true)
            for (item in blockedList) {
                if (node.text?.contains(item.websiteUrl) == true ) {

                    // Log.d("BlockedSite", "Node: ${node.className}, Text: ${node.text}")

                    val intent = Intent()
                    intent.setClassName("com.blocksiteapp", "com.blocksiteapp.BlockedPageActivity")
                    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    intent.putExtra("blocked_url", item.websiteUrl)
                    applicationContext.startActivity(intent)

                }
            }
        } 
        for (i in 0 until node.childCount) {
            traverseNode(node.getChild(i), foundFirstEditText)
        }
    }
}

