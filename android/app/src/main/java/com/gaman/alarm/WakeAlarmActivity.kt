package com.gaman.alarm

import android.app.Activity
import android.app.KeyguardManager
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.view.Gravity
import android.view.ViewGroup
import android.view.WindowManager
import android.widget.FrameLayout
import android.widget.VideoView
import com.gaman.GamanScreen
import com.gaman.R
import java.time.LocalTime
import java.time.format.DateTimeFormatter

/**
 * The wake-up alarm, shown over the lock screen:
 *   1. ringing, with one button to turn it off;
 *   2. the motivation video, which has no controls and can't be skipped;
 *   3. a short good-morning page that opens the day plan.
 */
class WakeAlarmActivity : Activity() {

    private enum class Stage { RINGING, VIDEO, DONE }

    private var stage = Stage.RINGING
    private var video: VideoView? = null
    private var videoPosition = 0

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        showOverLockScreen()
        showRinging()
    }

    /** The service relaunches us while ringing; keep whatever step is showing. */
    override fun onNewIntent(intent: Intent?) {
        super.onNewIntent(intent)
        setIntent(intent)
    }

    override fun onPause() {
        super.onPause()
        video?.let {
            videoPosition = it.currentPosition
            it.pause()
        }
    }

    override fun onResume() {
        super.onResume()
        video?.let {
            it.seekTo(videoPosition)
            it.start()
        }
    }

    override fun onDestroy() {
        stopVideo()
        super.onDestroy()
    }

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        // Ringing: only the button turns it off. Video: no way past it but watching.
        if (stage == Stage.DONE) finish()
    }

    // ---- Step 1 ---------------------------------------------------------------

    private fun showRinging() {
        stage = Stage.RINGING
        GamanScreen.show(
            this,
            GamanScreen.Spec(
                iconRes = R.drawable.ic_alarm,
                tone = GamanScreen.Tone.ACCENT,
                eyebrow = "Wake-up alarm",
                title = LocalTime.now().format(CLOCK),
                body = "Good morning. Your day starts now.",
                primaryLabel = "Turn off",
                onPrimary = { turnOff() },
            ),
        )
    }

    private fun turnOff() {
        WakeAlarmService.stop(this)
        showVideo()
    }

    // ---- Step 2 ---------------------------------------------------------------

    private fun showVideo() {
        stage = Stage.VIDEO
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        videoPosition = 0

        val player = VideoView(this).apply {
            setVideoURI(Uri.parse("android.resource://$packageName/${R.raw.motivation}"))
            setOnCompletionListener { if (stage == Stage.VIDEO) showDone() }
            // A broken player must not leave the user stuck on a black screen.
            setOnErrorListener { _, _, _ ->
                if (stage == Stage.VIDEO) showDone()
                true
            }
        }
        video = player

        val root = FrameLayout(this).apply {
            setBackgroundColor(Color.BLACK)
            addView(player, FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT,
                ViewGroup.LayoutParams.WRAP_CONTENT,
                Gravity.CENTER,
            ))
        }
        setContentView(root)
        GamanScreen.paintSystemBars(this, Color.BLACK, dark = true)
        player.start()
    }

    private fun stopVideo() {
        video?.stopPlayback()
        video = null
    }

    // ---- Step 3 ---------------------------------------------------------------

    private fun showDone() {
        stopVideo()
        stage = Stage.DONE
        window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        GamanScreen.show(
            this,
            GamanScreen.Spec(
                iconRes = R.drawable.ic_alarm,
                tone = GamanScreen.Tone.ACCENT,
                eyebrow = "Wake-up alarm",
                title = "You're up",
                body = "Start with the first task in your plan.",
                quote = "Win the morning, win the day.",
                primaryLabel = "Open my day",
                onPrimary = { openApp() },
                secondaryLabel = "Close",
                onSecondary = { finish() },
            ),
        )
    }

    private fun openApp() {
        val launch = packageManager.getLaunchIntentForPackage(packageName)
        val open = {
            launch?.let { startActivity(it.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) }
            finish()
        }
        val keyguard = getSystemService(KeyguardManager::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && keyguard?.isKeyguardLocked == true) {
            keyguard.requestDismissKeyguard(this, object : KeyguardManager.KeyguardDismissCallback() {
                override fun onDismissSucceeded() = open()
            })
        } else {
            open()
        }
    }

    private fun showOverLockScreen() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true)
            setTurnScreenOn(true)
        } else {
            @Suppress("DEPRECATION")
            window.addFlags(
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON,
            )
        }
    }

    companion object {
        private val CLOCK = DateTimeFormatter.ofPattern("HH:mm")

        fun intent(context: Context): Intent =
            Intent(context, WakeAlarmActivity::class.java)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_NO_USER_ACTION)
    }
}
