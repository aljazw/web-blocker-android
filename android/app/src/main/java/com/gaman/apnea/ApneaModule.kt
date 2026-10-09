package com.gaman.apnea

import android.view.WindowManager
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import org.json.JSONObject

/**
 * JS bridge for [ApneaSessionService]. State crosses the bridge as JSON
 * strings; the UI polls [getState] while it's visible.
 */
class ApneaModule(private val ctx: ReactApplicationContext) : ReactContextBaseJavaModule(ctx) {

    override fun getName(): String = "ApneaSession"

    @ReactMethod
    fun start(sessionJson: String, promise: Promise) = respond(promise) {
        ApneaSessionService.start(ctx, JSONObject(sessionJson))
        ApneaSessionService.state(ctx).toString()
    }

    @ReactMethod
    fun pause(promise: Promise) = respond(promise) { ApneaSessionService.pause(ctx); state() }

    @ReactMethod
    fun resume(promise: Promise) = respond(promise) { ApneaSessionService.resume(ctx); state() }

    @ReactMethod
    fun skip(promise: Promise) = respond(promise) { ApneaSessionService.skip(ctx); state() }

    @ReactMethod
    fun contraction(promise: Promise) = respond(promise) { ApneaSessionService.contraction(ctx); state() }

    @ReactMethod
    fun stop(promise: Promise) = respond(promise) { ApneaSessionService.stop(ctx); state() }

    @ReactMethod
    fun getState(promise: Promise) = respond(promise) {
        ApneaSessionService.ensureRunning(ctx)
        state()
    }

    /** The finished session's result, once; null if there is none. */
    @ReactMethod
    fun consumeResult(promise: Promise) = respond(promise) { ApneaSessionService.consumeResult(ctx)?.toString() }

    @ReactMethod
    fun previewCue(cue: String, sound: Boolean, vibration: Boolean, promise: Promise) = respond(promise) {
        ApneaSessionService.preview(ctx, Cue.valueOf(cue), CueSettings(sound, vibration, 0))
        true
    }

    /** Keeps the screen on while the session screen is open. */
    @ReactMethod
    fun setKeepAwake(enabled: Boolean) {
        val activity = currentActivity ?: return
        activity.runOnUiThread {
            if (enabled) activity.window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
            else activity.window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        }
    }

    private fun state() = ApneaSessionService.state(ctx).toString()

    private fun respond(promise: Promise, block: () -> Any?) {
        try {
            promise.resolve(block())
        } catch (e: IllegalStateException) {
            promise.reject("session_busy", e.message, e)
        } catch (e: Exception) {
            promise.reject("session_error", e.message, e)
        }
    }
}

