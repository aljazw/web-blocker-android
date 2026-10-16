package com.disciplineapp.alarm

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.media.RingtoneManager
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import android.os.VibrationEffect
import android.os.Vibrator
import androidx.core.app.NotificationCompat
import com.disciplineapp.R

/**
 * Rings until the user turns the alarm off on [WakeAlarmActivity] (which then
 * plays the motivation video), or for [MAX_RING_MS] at most. The notification
 * has no dismiss action on purpose: the only way to silence it is the alarm
 * screen, so the video always follows.
 */
class WakeAlarmService : Service() {

    private var player: MediaPlayer? = null
    private var vibrator: Vibrator? = null
    private var wakeLock: PowerManager.WakeLock? = null
    private val handler = Handler(Looper.getMainLooper())
    private val timeout = Runnable { stopRinging() }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_STOP) {
            stopRinging()
            return START_NOT_STICKY
        }
        ensureChannel(this)
        startAsForeground(buildNotification())
        if (player == null) startRinging()
        // Screen on and unlocked, the full-screen intent only shows a heads-up; open the page anyway.
        try {
            startActivity(WakeAlarmActivity.intent(this))
        } catch (_: Exception) { }
        return START_NOT_STICKY
    }

    override fun onDestroy() {
        releaseAll()
        super.onDestroy()
    }

    private fun startRinging() {
        ringing = true
        wakeLock = getSystemService(PowerManager::class.java)
            ?.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "disciplineapp:wake_alarm")
            ?.apply { acquire(MAX_RING_MS + 10_000) }

        val uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
            ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE)
            ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
        player = try {
            MediaPlayer().apply {
                setAudioAttributes(
                    AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_ALARM)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build(),
                )
                setDataSource(this@WakeAlarmService, uri)
                isLooping = true
                prepare()
                start()
            }
        } catch (_: Exception) {
            null
        }

        vibrator = getSystemService(Vibrator::class.java)?.apply {
            val pattern = longArrayOf(0, 600, 400)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) vibrate(VibrationEffect.createWaveform(pattern, 1))
            else @Suppress("DEPRECATION") vibrate(pattern, 1)
        }
        handler.postDelayed(timeout, MAX_RING_MS)
    }

    private fun stopRinging() {
        releaseAll()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) stopForeground(STOP_FOREGROUND_REMOVE)
        else @Suppress("DEPRECATION") stopForeground(true)
        stopSelf()
    }

    private fun releaseAll() {
        ringing = false
        handler.removeCallbacks(timeout)
        try {
            player?.stop()
        } catch (_: Exception) { }
        player?.release()
        player = null
        vibrator?.cancel()
        vibrator = null
        wakeLock?.takeIf { it.isHeld }?.release()
        wakeLock = null
    }

    private fun startAsForeground(notification: Notification) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            val type = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE)
                ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE else 0
            startForeground(NOTIF_ID, notification, type)
        } else {
            startForeground(NOTIF_ID, notification)
        }
    }

    private fun buildNotification(): Notification {
        val open = PendingIntent.getActivity(
            this,
            0,
            WakeAlarmActivity.intent(this),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        return NotificationCompat.Builder(this, CHANNEL)
            .setSmallIcon(R.drawable.ic_stat_app)
            .setContentTitle("Time to wake up")
            .setContentText("Tap to turn off the alarm")
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setOngoing(true)
            .setContentIntent(open)
            .setFullScreenIntent(open, true)
            .build()
    }

    companion object {
        private const val CHANNEL = "wake_alarm"
        private const val NOTIF_ID = 7003
        private const val ACTION_STOP = "com.disciplineapp.alarm.STOP"
        private const val MAX_RING_MS = 10 * 60 * 1000L

        /** True while the alarm sound plays. */
        @Volatile
        var ringing = false
            private set

        fun start(context: Context) {
            val intent = Intent(context, WakeAlarmService::class.java)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) context.startForegroundService(intent)
            else context.startService(intent)
        }

        fun stop(context: Context) {
            if (!ringing) return
            context.startService(Intent(context, WakeAlarmService::class.java).setAction(ACTION_STOP))
        }

        private fun ensureChannel(context: Context) {
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
            context.getSystemService(NotificationManager::class.java).createNotificationChannel(
                NotificationChannel(CHANNEL, "Wake-up alarm", NotificationManager.IMPORTANCE_HIGH).apply {
                    description = "Rings at your day plan's wake-up time."
                    // The service plays the sound and vibration itself.
                    setSound(null, null)
                    enableVibration(false)
                    lockscreenVisibility = Notification.VISIBILITY_PUBLIC
                    setShowBadge(false)
                },
            )
        }
    }
}
