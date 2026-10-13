package com.gaman.modules

import android.app.Activity
import android.content.Intent
import android.net.Uri
import com.facebook.react.bridge.ActivityEventListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

/**
 * Saves and opens backup files through Android's file picker, so the user
 * chooses where a backup goes (Downloads, Drive, ...) and no storage
 * permission is needed.
 *
 *  - save(fileName, content): resolves true when written, false if cancelled.
 *  - open(): resolves the chosen file's text, or null if cancelled.
 */
class BackupFileModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext), ActivityEventListener {

    private var pending: Promise? = null
    private var pendingContent: String? = null

    init {
        reactContext.addActivityEventListener(this)
    }

    override fun getName(): String = "BackupFile"

    @ReactMethod
    fun save(fileName: String, content: String, promise: Promise) {
        val intent = Intent(Intent.ACTION_CREATE_DOCUMENT)
            .addCategory(Intent.CATEGORY_OPENABLE)
            .setType("application/json")
            .putExtra(Intent.EXTRA_TITLE, fileName)
        launch(intent, REQUEST_SAVE, promise, content)
    }

    @ReactMethod
    fun open(promise: Promise) {
        val intent = Intent(Intent.ACTION_OPEN_DOCUMENT)
            .addCategory(Intent.CATEGORY_OPENABLE)
            .setType("*/*")
            // Some file managers label .json files as text or binary.
            .putExtra(Intent.EXTRA_MIME_TYPES, arrayOf("application/json", "text/*", "application/octet-stream"))
        launch(intent, REQUEST_OPEN, promise, null)
    }

    private fun launch(intent: Intent, request: Int, promise: Promise, content: String?) {
        val activity = currentActivity
        if (activity == null) {
            promise.reject("no_activity", "Open Gaman to use backups.")
            return
        }
        // A picker that never returned must not block the next attempt.
        pending?.resolve(null)
        pending = promise
        pendingContent = content
        try {
            activity.startActivityForResult(intent, request)
        } catch (e: Exception) {
            pending = null
            pendingContent = null
            promise.reject("picker_failed", e)
        }
    }

    override fun onActivityResult(activity: Activity?, requestCode: Int, resultCode: Int, data: Intent?) {
        if (requestCode != REQUEST_SAVE && requestCode != REQUEST_OPEN) return
        val promise = pending ?: return
        val content = pendingContent
        pending = null
        pendingContent = null

        val uri: Uri? = data?.data
        if (resultCode != Activity.RESULT_OK || uri == null) {
            promise.resolve(if (requestCode == REQUEST_SAVE) false else null)
            return
        }
        try {
            if (requestCode == REQUEST_SAVE) {
                reactContext.contentResolver.openOutputStream(uri, "wt")?.use {
                    it.write((content ?: "").toByteArray(Charsets.UTF_8))
                } ?: throw IllegalStateException("Could not open the file for writing.")
                promise.resolve(true)
            } else {
                val bytes = reactContext.contentResolver.openInputStream(uri)?.use { input ->
                    val buffer = input.readBytes()
                    if (buffer.size > MAX_BYTES) throw IllegalStateException("That file is too large to be a Gaman backup.")
                    buffer
                } ?: throw IllegalStateException("Could not open the file.")
                promise.resolve(String(bytes, Charsets.UTF_8))
            }
        } catch (e: Exception) {
            promise.reject("file_failed", e.message ?: "Could not use that file.", e)
        }
    }

    override fun onNewIntent(intent: Intent?) { /* no-op */ }

    companion object {
        private const val REQUEST_SAVE = 0x6A01
        private const val REQUEST_OPEN = 0x6A02
        private const val MAX_BYTES = 20 * 1024 * 1024
    }
}
