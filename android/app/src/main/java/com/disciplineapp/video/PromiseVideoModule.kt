package com.disciplineapp.video

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

/** JS bridge: plays the "keep your word" video before planning tomorrow. */
class PromiseVideoModule(private val ctx: ReactApplicationContext) : ReactContextBaseJavaModule(ctx) {

    override fun getName(): String = "PromiseVideo"

    @ReactMethod
    fun play() {
        val activity = ctx.currentActivity
        if (activity != null) {
            activity.startActivity(PromiseVideoActivity.intent(activity))
        } else {
            ctx.startActivity(PromiseVideoActivity.intent(ctx))
        }
    }
}
