package com.blocksiteapp

import android.accessibilityservice.AccessibilityService
import android.view.accessibility.AccessibilityEvent
import android.content.Intent
import android.net.Uri
import android.util.Log
import android.view.accessibility.AccessibilityNodeInfo
import java.util.concurrent.atomic.AtomicBoolean



class BlockAccessibilityService : AccessibilityService() {

    private val blockedUrls = arrayOf("123moviestv.net", "instagram.com", "youtube.com", "google.com")
    private var lastProcessedTime: Long = 0
    private val debounceInterval = 1000L

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {

        if (System.currentTimeMillis() - lastProcessedTime < debounceInterval) {
            return
        }
        lastProcessedTime = System.currentTimeMillis()

        event?.let {
            Log.d("Randomwords", "\nEvent type: ${AccessibilityEvent.eventTypeToString(it.eventType)}")
        }

        val rootNode = rootInActiveWindow
        if (rootNode != null) {
            var foundFirstEditText = AtomicBoolean(false)
            traverseNode(rootNode, foundFirstEditText)  
        }
    }
        
        
    // if (event?.eventType == AccessibilityEvent.TYPE_VIEW_TEXT_CHANGED && event.text != null) {
    //     val eventText = event.text.joinToString(" ").toLowerCase()
    //     Log.d("Randomwords", "Content Changed: ${event.text}")

    //     for (url in blockedUrls) {
    //         if (eventText.contains(url)) {
    //             val intent = Intent(Intent.ACTION_VIEW)
    //             intent.data = Uri.parse("yourapp://blocked") // Custom scheme
    //             intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    //             startActivity(intent)

    //             Log.d("Randomwords", "Redirecting to blocked screen")
    //             break
    //         }
    //     }
    // }
    

    override fun onInterrupt() {
        // Handle interruption if needed
    }


    private fun traverseNode(node: AccessibilityNodeInfo?, foundFirstEditText: AtomicBoolean) {
        if (node == null || foundFirstEditText.get()) return 
        

        if(node.className == "android.widget.EditText" && !node.isFocused){
            foundFirstEditText.set(true)
            for (url in blockedUrls) {
                if (node.text?.contains(url) == true ) {
                    Log.d("Randomwords", "Node: ${node.className}, Text: ${node.text}")
                }
            }
        } 


        // Log.d("Randomwords", "Node: ${node.className}, Text: ${node.text}")

        for (i in 0 until node.childCount) {
            traverseNode(node.getChild(i), foundFirstEditText)
        }
    }

}

