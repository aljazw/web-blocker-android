package com.sitelock.apnea

import android.content.Context
import android.media.AudioManager
import android.media.ToneGenerator
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager

/**
 * Plays session cues as tones (media volume) and vibration patterns, so the
 * user can train with eyes closed and the phone face down. No audio files.
 */
class CuePlayer(context: Context) {
    private val vibrator: Vibrator? =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            (context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as? VibratorManager)?.defaultVibrator
        } else {
            @Suppress("DEPRECATION")
            context.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
        }

    // ToneGenerator can fail to initialise on some devices; cues then fall back to vibration only.
    private val tones: ToneGenerator? = runCatching { ToneGenerator(AudioManager.STREAM_MUSIC, 90) }.getOrNull()

    fun play(cue: Cue, settings: CueSettings) {
        val (tone, toneMs, pattern) = spec(cue)
        if (settings.sound) runCatching { tones?.startTone(tone, toneMs) }
        if (settings.vibration) vibrate(pattern)
    }

    fun release() {
        tones?.release()
    }

    private fun vibrate(pattern: LongArray) {
        val v = vibrator ?: return
        if (!v.hasVibrator()) return
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            v.vibrate(VibrationEffect.createWaveform(pattern, -1))
        } else {
            @Suppress("DEPRECATION")
            v.vibrate(pattern, -1)
        }
    }

    private fun spec(cue: Cue): Triple<Int, Int, LongArray> = when (cue) {
        Cue.HOLD -> Triple(ToneGenerator.TONE_DTMF_D, 450, longArrayOf(0, 450))
        Cue.BREATHE -> Triple(ToneGenerator.TONE_PROP_ACK, 300, longArrayOf(0, 120, 90, 120))
        Cue.SOFT_CHANGE -> Triple(ToneGenerator.TONE_PROP_BEEP, 70, longArrayOf(0, 50))
        Cue.TICK -> Triple(ToneGenerator.TONE_PROP_BEEP, 100, longArrayOf(0, 35))
        Cue.WARNING -> Triple(ToneGenerator.TONE_PROP_BEEP2, 250, longArrayOf(0, 70, 80, 70))
        Cue.PULSE -> Triple(ToneGenerator.TONE_PROP_BEEP, 60, longArrayOf(0, 50))
        Cue.FINISH -> Triple(ToneGenerator.TONE_CDMA_CONFIRM, 700, longArrayOf(0, 250, 120, 250, 120, 500))
    }
}
