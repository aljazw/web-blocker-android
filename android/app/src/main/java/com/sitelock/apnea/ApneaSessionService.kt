package com.sitelock.apnea

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import android.os.SystemClock
import androidx.core.app.NotificationCompat
import com.sitelock.R
import org.json.JSONObject

/**
 * Runs a breath-hold session independently of the UI: it owns the clock,
 * plays cues, holds a wake lock so the CPU can't sleep through a phase, and
 * shows a live notification with controls. Closing or killing the app does not
 * stop the session; if Android kills the process, START_STICKY restarts the
 * service and the persisted timeline continues where it left off.
 */
class ApneaSessionService : Service() {

    private val handler = Handler(Looper.getMainLooper())
    private lateinit var cuePlayer: CuePlayer
    private var wakeLock: PowerManager.WakeLock? = null
    /** Last (phase index, paused) shown in the notification, to update it only on change. */
    private var shownState: Pair<Int, Boolean>? = null

    private val loop = object : Runnable {
        override fun run() {
            val cues = mutate { tl -> tl.tick(SystemClock.elapsedRealtime(), System.currentTimeMillis()) }
            onChanged(cues ?: emptyList())
            if (timeline != null) handler.postDelayed(this, TICK_MS)
        }
    }

    override fun onCreate() {
        super.onCreate()
        instance = this
        cuePlayer = CuePlayer(this)
        ensureChannels(this)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (timeline == null) restore(this)
        val tl = timeline
        // Every start must promote to foreground (Android requires it after
        // startForegroundService), even a stale notification button press.
        if (tl == null) {
            startAsForeground(
                NotificationCompat.Builder(this, CHANNEL_SESSION)
                    .setSmallIcon(R.drawable.ic_stat_sitelock)
                    .setContentTitle("Session ended")
                    .build(),
            )
            shutDown()
            return START_NOT_STICKY
        }
        startAsForeground(buildNotification(tl))

        when (intent?.action) {
            ACTION_PAUSE -> pause(this)
            ACTION_RESUME -> resume(this)
            ACTION_SKIP -> skip(this)
            ACTION_STOP -> stop(this)
            ACTION_RUN -> if (intent.getBooleanExtra(EXTRA_FRESH, false)) {
                synchronized(lock) { tl.openingCue() }?.let { cuePlayer.play(it, tl.cues) }
            }
        }

        acquireWakeLock()
        handler.removeCallbacks(loop)
        handler.post(loop)
        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        handler.removeCallbacks(loop)
        releaseWakeLock()
        // Let a final cue (e.g. the finish tone) play out before releasing the tone generator.
        val player = cuePlayer
        handler.postDelayed({ player.release() }, CUE_TAIL_MS)
        if (instance === this) instance = null
        super.onDestroy()
    }

    /** Called after any change (tick or user action): play cues, refresh the notification, wrap up. */
    private fun onChanged(cues: List<Cue>) {
        cues.forEach { cuePlayer.play(it, lastCues) }
        storeResultIfFinished(this)
        val tl = timeline
        if (tl == null) {
            shutDown()
            return
        }
        val state = synchronized(lock) { tl.index to tl.isPaused }
        if (state != shownState) {
            shownState = state
            persist(this)
            notificationManager().notify(NOTIF_ID, buildNotification(tl))
        }
    }

    private fun shutDown() {
        handler.removeCallbacks(loop)
        releaseWakeLock()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            stopForeground(STOP_FOREGROUND_REMOVE)
        } else {
            @Suppress("DEPRECATION")
            stopForeground(true)
        }
        lastFinished?.takeIf { it.completed }?.let(::postDoneNotification)
        lastFinished = null
        stopSelf()
    }

    // ---- notifications ------------------------------------------------------

    private fun startAsForeground(notification: Notification) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            val type = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE)
                ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE else 0
            startForeground(NOTIF_ID, notification, type)
        } else {
            startForeground(NOTIF_ID, notification)
        }
    }

    private fun buildNotification(tl: Timeline): Notification = synchronized(lock) {
        val now = SystemClock.elapsedRealtime()
        val wall = System.currentTimeMillis()
        val phase = tl.current
        val rounds = tl.phases.maxOfOrNull { it.round } ?: 0
        val elapsed = tl.phaseElapsed(now)

        val builder = NotificationCompat.Builder(this, CHANNEL_SESSION)
            .setSmallIcon(R.drawable.ic_stat_sitelock)
            .setContentTitle("${phaseLabel(phase?.type)} · ${tl.title}")
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setSilent(true)
            .setCategory(NotificationCompat.CATEGORY_PROGRESS)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setContentIntent(openAppIntent())

        val roundText = if (rounds > 1 && phase != null) "Round ${phase.round} of $rounds" else null
        if (tl.isPaused || phase == null) {
            builder.setContentText(listOfNotNull("Paused", roundText).joinToString(" · "))
        } else {
            builder.setContentText(roundText ?: if (phase.isOpen) "Tap Stop when you breathe" else "")
                .setUsesChronometer(true)
            if (phase.isOpen) {
                builder.setWhen(wall - elapsed)
            } else {
                builder.setWhen(wall + (phase.durationMs - elapsed)).setChronometerCountDown(true)
            }
        }

        if (tl.isPaused) {
            builder.addAction(0, "Resume", serviceIntent(ACTION_RESUME, 1))
        } else {
            builder.addAction(0, "Pause", serviceIntent(ACTION_PAUSE, 1))
            when {
                phase?.isHold == true -> builder.addAction(0, if (phase.isOpen) "Stop hold" else "End hold", serviceIntent(ACTION_SKIP, 2))
                phase?.isApnea == true -> builder.addAction(0, "Hold now", serviceIntent(ACTION_SKIP, 2))
            }
        }
        builder.addAction(0, "End session", serviceIntent(ACTION_STOP, 3))
        builder.build()
    }

    private fun postDoneNotification(tl: Timeline) {
        val notification = NotificationCompat.Builder(this, CHANNEL_DONE)
            .setSmallIcon(R.drawable.ic_stat_sitelock)
            .setContentTitle("${tl.title} complete")
            .setContentText("Open Gaman to see your results.")
            .setAutoCancel(true)
            .setContentIntent(openAppIntent())
            .build()
        notificationManager().notify(DONE_NOTIF_ID, notification)
    }

    private fun openAppIntent(): PendingIntent = PendingIntent.getActivity(
        this, 0,
        packageManager.getLaunchIntentForPackage(packageName)!!.addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP),
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )

    private fun serviceIntent(action: String, requestCode: Int): PendingIntent {
        val intent = Intent(this, ApneaSessionService::class.java).setAction(action)
        val flags = PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            PendingIntent.getForegroundService(this, requestCode, intent, flags)
        } else {
            PendingIntent.getService(this, requestCode, intent, flags)
        }
    }

    private fun notificationManager() = getSystemService(NotificationManager::class.java)

    // ---- wake lock ----------------------------------------------------------

    private fun acquireWakeLock() {
        if (wakeLock?.isHeld == true) return
        wakeLock = (getSystemService(Context.POWER_SERVICE) as PowerManager)
            .newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "sitelock:apnea-session")
            .apply {
                setReferenceCounted(false)
                acquire(MAX_SESSION_MS)
            }
    }

    private fun releaseWakeLock() {
        wakeLock?.takeIf { it.isHeld }?.release()
        wakeLock = null
    }

    companion object {
        const val ACTION_RUN = "com.sitelock.apnea.RUN"
        const val ACTION_PAUSE = "com.sitelock.apnea.PAUSE"
        const val ACTION_RESUME = "com.sitelock.apnea.RESUME"
        const val ACTION_SKIP = "com.sitelock.apnea.SKIP"
        const val ACTION_STOP = "com.sitelock.apnea.STOP"
        private const val EXTRA_FRESH = "fresh"

        private const val CHANNEL_SESSION = "apnea_session"
        private const val CHANNEL_DONE = "apnea_done"
        private const val NOTIF_ID = 4201
        const val DONE_NOTIF_ID = 4202

        private const val PREFS = "ApneaSession"
        private const val KEY_ACTIVE = "active"
        private const val KEY_RESULT = "result"

        private const val TICK_MS = 200L
        private const val CUE_TAIL_MS = 1_500L
        private const val MAX_SESSION_MS = 3 * 60 * 60 * 1000L

        private val lock = Any()
        @Volatile private var timeline: Timeline? = null
        @Volatile private var instance: ApneaSessionService? = null
        /** Cue settings of the last session, so its final cue still respects them. */
        @Volatile private var lastFinished: Timeline? = null
        @Volatile private var lastCues = CueSettings(sound = true, vibration = true, pulseEveryMs = 0)

        /** Starts a session described by the app. Fails if one is already running. */
        fun start(context: Context, json: JSONObject) {
            synchronized(lock) {
                if (timeline == null) restore(context)
                check(timeline == null) { "A session is already running" }
                val tl = Timeline.create(json, SystemClock.elapsedRealtime(), System.currentTimeMillis())
                timeline = tl
                lastCues = tl.cues
            }
            prefs(context).edit().remove(KEY_RESULT).apply()
            persist(context)
            val intent = Intent(context, ApneaSessionService::class.java)
                .setAction(ACTION_RUN)
                .putExtra(EXTRA_FRESH, true)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }
        }

        fun pause(context: Context) = act(context) { it.pause(SystemClock.elapsedRealtime()); emptyList() }

        fun resume(context: Context) = act(context) { it.resume(SystemClock.elapsedRealtime()); emptyList() }

        fun skip(context: Context) = act(context) { it.skip(SystemClock.elapsedRealtime(), System.currentTimeMillis()) }

        fun contraction(context: Context) = act(context) { it.contraction(SystemClock.elapsedRealtime()); emptyList() }

        fun stop(context: Context) = act(context) { it.stop(SystemClock.elapsedRealtime(), System.currentTimeMillis()); emptyList() }

        /**
         * Restarts the service if a session exists but nothing is running it, e.g.
         * Android killed the process and wasn't allowed to restart it in the background.
         * Call while the app is in the foreground.
         */
        fun ensureRunning(context: Context) {
            if (instance != null) return
            val hasSession = synchronized(lock) {
                if (timeline == null) restore(context)
                timeline != null
            }
            if (!hasSession) return
            val intent = Intent(context, ApneaSessionService::class.java).setAction(ACTION_RUN)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }
        }

        /** The live session, or the finished result waiting to be collected, or {status: idle}. */
        fun state(context: Context): JSONObject {
            synchronized(lock) {
                if (timeline == null) restore(context)
                timeline?.let { return it.toJson(SystemClock.elapsedRealtime(), System.currentTimeMillis()) }
            }
            return prefs(context).getString(KEY_RESULT, null)?.let { runCatching { JSONObject(it) }.getOrNull() }
                ?: JSONObject().put("status", "idle")
        }

        /** Hands the finished result to the app exactly once. */
        fun consumeResult(context: Context): JSONObject? {
            val p = prefs(context)
            val raw = synchronized(lock) {
                p.getString(KEY_RESULT, null)?.also { p.edit().remove(KEY_RESULT).commit() }
            } ?: return null
            context.getSystemService(NotificationManager::class.java).cancel(DONE_NOTIF_ID)
            return runCatching { JSONObject(raw) }.getOrNull()
        }

        /** Plays one cue, for "test sound" in settings. */
        fun preview(context: Context, cue: Cue, settings: CueSettings) {
            val player = CuePlayer(context)
            player.play(cue, settings)
            Handler(Looper.getMainLooper()).postDelayed({ player.release() }, 1500)
        }

        private fun act(context: Context, change: (Timeline) -> List<Cue>) {
            val cues = mutate(change) ?: return
            persist(context)
            // Saved here too, so a result is never lost even if the service isn't alive yet.
            storeResultIfFinished(context)
            instance?.let { service -> service.handler.post { service.onChanged(cues) } }
        }

        /** Moves a finished session from "active" to "result" in storage. */
        private fun storeResultIfFinished(context: Context) {
            val result = synchronized(lock) {
                val tl = timeline?.takeIf { it.finished } ?: return
                timeline = null
                lastFinished = tl
                tl.toJson(SystemClock.elapsedRealtime(), System.currentTimeMillis())
            }
            prefs(context).edit().remove(KEY_ACTIVE).putString(KEY_RESULT, result.toString()).apply()
        }

        private fun <T> mutate(change: (Timeline) -> T): T? = synchronized(lock) { timeline?.let(change) }

        private fun persist(context: Context) {
            val json = synchronized(lock) {
                timeline?.toJson(SystemClock.elapsedRealtime(), System.currentTimeMillis())
            } ?: return
            prefs(context).edit().putString(KEY_ACTIVE, json.toString()).apply()
        }

        /** Loads a persisted session after a process restart. Caller holds the lock or is single-threaded. */
        private fun restore(context: Context) {
            val raw = prefs(context).getString(KEY_ACTIVE, null) ?: return
            val restored = runCatching { JSONObject(raw) }.getOrNull()
                ?.let { Timeline.restore(it, SystemClock.elapsedRealtime(), System.currentTimeMillis()) }
            if (restored == null || restored.finished) {
                prefs(context).edit().remove(KEY_ACTIVE).apply()
                return
            }
            timeline = restored
            lastCues = restored.cues
        }

        private fun prefs(context: Context) =
            context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

        private fun ensureChannels(context: Context) {
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
            val nm = context.getSystemService(NotificationManager::class.java)
            nm.createNotificationChannel(
                NotificationChannel(CHANNEL_SESSION, "Breath-hold session", NotificationManager.IMPORTANCE_LOW).apply {
                    description = "Live timer and controls while a training session runs."
                    setSound(null, null)
                    enableVibration(false)
                    setShowBadge(false)
                },
            )
            nm.createNotificationChannel(
                NotificationChannel(CHANNEL_DONE, "Session results", NotificationManager.IMPORTANCE_DEFAULT).apply {
                    description = "Tells you when a training session has finished."
                    setSound(null, null)
                },
            )
        }

        private fun phaseLabel(type: String?) = when (type) {
            Phase.HOLD -> "Hold"
            Phase.BREATHE -> "Breathe"
            Phase.PREPARE -> "Breathe up"
            "inhale" -> "Inhale"
            "exhale" -> "Exhale"
            "holdIn" -> "Hold in"
            "holdOut" -> "Hold out"
            null -> "Done"
            else -> type.replaceFirstChar { it.uppercase() }
        }
    }
}
