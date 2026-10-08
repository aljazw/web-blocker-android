package com.sitelock.sleep

import android.app.Activity
import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.os.Bundle
import android.view.Gravity
import android.view.ViewGroup
import android.view.WindowManager
import android.view.inputmethod.EditorInfo
import android.widget.FrameLayout
import android.widget.VideoView
import com.sitelock.R
import com.sitelock.SiteLockScreen
import java.time.format.DateTimeFormatter

/**
 * Covers every app during sleep time. Turning sleep time off for the night
 * takes three steps, so it never happens on impulse:
 *   1. the sleep page, whose main action is the home screen;
 *   2. the "hard thing to do" video, which has no controls and can't be skipped;
 *   3. typing a short motivational sentence.
 * Leaving during step 2 or 3 starts over from step 1.
 */
class SleepActivity : Activity() {

    private enum class Stage { SLEEP, VIDEO, PASSPHRASE }

    private var stage = Stage.SLEEP
    private var video: VideoView? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        showSleepPage()
    }

    /** The accessibility service relaunches us on every app switch; keep whatever step is showing. */
    override fun onNewIntent(intent: Intent?) {
        super.onNewIntent(intent)
        setIntent(intent)
    }

    override fun onResume() {
        super.onResume()
        // Sleep time ended (or was turned off in the app) while this page was open.
        if (stage == Stage.SLEEP && !SleepSchedule.isSleepTimeNow(SleepSchedule.prefs(this))) finish()
    }

    override fun onStop() {
        super.onStop()
        // Walking away mid-unlock (or the screen turning off) means starting over.
        if (stage != Stage.SLEEP && !isFinishing) {
            stopVideo()
            showSleepPage()
        }
    }

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        when (stage) {
            Stage.VIDEO -> Unit // no way past the video but watching it
            Stage.PASSPHRASE -> showSleepPage()
            Stage.SLEEP -> goHome()
        }
    }

    // ---- Step 1 ---------------------------------------------------------------

    private fun showSleepPage() {
        stage = Stage.SLEEP
        window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        val wake = SleepSchedule.load(SleepSchedule.prefs(this)).wake.format(CLOCK)
        SiteLockScreen.show(
            this,
            SiteLockScreen.Spec(
                iconRes = R.drawable.ic_moon,
                tone = SiteLockScreen.Tone.ACCENT,
                eyebrow = "Sleep time",
                title = "Time to rest",
                body = "Your phone is off-limits until $wake. Calls and alarms still work.",
                quote = "Tomorrow is won tonight. Put the phone down.",
                primaryLabel = "Go to home screen",
                onPrimary = { goHome() },
                secondaryLabel = "Turn off sleep time",
                onSecondary = { showVideo() },
            ),
        )
    }

    // ---- Step 2 ---------------------------------------------------------------

    private fun showVideo() {
        stage = Stage.VIDEO
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

        val player = VideoView(this).apply {
            setVideoURI(Uri.parse("android.resource://$packageName/${R.raw.hard_thing_to_do}"))
            setOnCompletionListener { if (stage == Stage.VIDEO) showPassphrase() }
            // A broken player must not lock the user out for good; the passphrase still guards.
            setOnErrorListener { _, _, _ ->
                if (stage == Stage.VIDEO) showPassphrase()
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
        SiteLockScreen.paintSystemBars(this, Color.BLACK, dark = true)
        player.start()
    }

    private fun stopVideo() {
        video?.stopPlayback()
        video = null
    }

    // ---- Step 3 ---------------------------------------------------------------

    private fun showPassphrase() {
        stopVideo()
        stage = Stage.PASSPHRASE
        window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

        val phrase = PASSPHRASES.random()
        val input = SiteLockScreen.input(this, "Type the sentence above")

        val submit = {
            if (matches(phrase, input.field.text.toString())) {
                SleepSchedule.dismissTonight(this)
                goHome()
            } else {
                input.showError("Not quite. Type it exactly as shown.")
            }
        }
        input.field.setOnEditorActionListener { _, actionId, _ ->
            if (actionId == EditorInfo.IME_ACTION_DONE) submit()
            true
        }
        input.field.addTextChangedListener(object : android.text.TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) = Unit
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) = input.clearError()
            override fun afterTextChanged(s: android.text.Editable?) = Unit
        })

        SiteLockScreen.show(
            this,
            SiteLockScreen.Spec(
                iconRes = R.drawable.ic_moon,
                tone = SiteLockScreen.Tone.ACCENT,
                eyebrow = "Sleep time",
                title = "Still want to stay up?",
                body = "Type this sentence to turn sleep time off until morning.",
                quote = phrase,
                extra = input.root,
                primaryLabel = "Turn off until morning",
                onPrimary = submit,
                secondaryLabel = "I'll go to sleep",
                onSecondary = { goHome() },
            ),
        )
    }

    private fun goHome() {
        stopVideo()
        try {
            startActivity(Intent(Intent.ACTION_MAIN).apply {
                addCategory(Intent.CATEGORY_HOME)
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            })
        } catch (_: Exception) { }
        finish()
    }

    companion object {
        private val CLOCK = DateTimeFormatter.ofPattern("HH:mm")

        /** Short on purpose: the video is the hard part, the sentence is the reminder. */
        val PASSPHRASES = listOf(
            "Habits are everything",
            "Discipline is choosing what I want most",
            "Rest now, win tomorrow",
            "Sleep is part of the work",
            "I keep the promises I make to myself",
            "Small choices build a great life",
            "Do the hard thing",
            "Endure now, thrive later",
        )

        private fun normalize(text: String) = text.trim().replace(Regex("\\s+"), " ").lowercase()

        /** Case and extra spaces don't matter; the words do. */
        fun matches(expected: String, typed: String) = normalize(expected) == normalize(typed)
    }
}
