package com.gaman

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.database.ContentObserver
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.HandlerThread
import android.os.IBinder
import android.provider.Settings
import androidx.core.app.NotificationCompat

/**
 * Independent foreground service that guarantees Gaman notices the instant
 * the accessibility service is turned off — on ANY device, in ANY language.
 *
 * How it works:
 *  - It is NOT the accessibility service, so disabling accessibility does not
 *    kill it. It keeps running as a foreground service.
 *  - It registers a ContentObserver on the framework's own
 *    ENABLED_ACCESSIBILITY_SERVICES / ACCESSIBILITY_ENABLED settings. The
 *    moment the user flips the toggle, that setting changes and we are called
 *    back immediately — no Settings-UI parsing involved.
 *  - A 1-second poll runs as a belt-and-suspenders fallback for the rare OEM
 *    that delivers observer callbacks unreliably.
 *  - When it sees the service went from enabled -> disabled, it launches the
 *    re-enable flow (full-screen activity if we have overlay permission, and a
 *    high-priority full-screen-intent notification as a universal fallback).
 *
 * Honest ceiling: no non-"Device Owner" app can physically freeze the toggle,
 * and a hard "Force stop" from App Info stops everything until the app is
 * opened again — that's an OS guarantee. This makes staying disabled as
 * inconvenient as possible without those special privileges.
 */
class WatchdogService : Service() {

    private lateinit var handlerThread: HandlerThread
    private lateinit var handler: Handler
    private var observer: ContentObserver? = null

    @Volatile private var wasEnabled = true
    @Volatile private var lastAlertAt = 0L

    private val poll = object : Runnable {
        override fun run() {
            checkState()
            handler.postDelayed(this, POLL_INTERVAL_MS)
        }
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        startAsForeground()
        isRunning.set(true)

        handlerThread = HandlerThread("gaman-watchdog").apply { start() }
        handler = Handler(handlerThread.looper)

        wasEnabled = AccessibilityUtils.isServiceEnabled(this)
        registerObserver()
        handler.post(poll)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        // Make sure we always hold a foreground notification even if restarted.
        startAsForeground()
        return START_STICKY
    }

    override fun onTaskRemoved(rootIntent: Intent?) {
        // User swiped the app from recents — bring ourselves back.
        ensureRunning(applicationContext)
        super.onTaskRemoved(rootIntent)
    }

    override fun onDestroy() {
        isRunning.set(false)
        observer?.let { contentResolver.unregisterContentObserver(it) }
        if (::handler.isInitialized) handler.removeCallbacksAndMessages(null)
        if (::handlerThread.isInitialized) handlerThread.quitSafely()
        super.onDestroy()
    }

    private fun registerObserver() {
        val obs = object : ContentObserver(handler) {
            override fun onChange(selfChange: Boolean, uri: Uri?) = checkState()
        }
        observer = obs
        contentResolver.registerContentObserver(
            Settings.Secure.getUriFor(Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES),
            false, obs
        )
        contentResolver.registerContentObserver(
            Settings.Secure.getUriFor(Settings.Secure.ACCESSIBILITY_ENABLED),
            false, obs
        )
    }

    @Synchronized
    private fun checkState() {
        val enabled = AccessibilityUtils.isServiceEnabled(this)
        if (!enabled) {
            // Keep nagging while it stays off: re-fire the alert every minute.
            val now = System.currentTimeMillis()
            if (now - lastAlertAt >= RE_ALERT_MS) {
                lastAlertAt = now
                fireAlert(this)
            }
        } else {
            if (lastAlertAt != 0L) {
                lastAlertAt = 0L
                onProtectionRestored()
            }
        }
        wasEnabled = enabled
    }

    private fun onProtectionRestored() {
        notificationManager().cancel(ALERT_NOTIF_ID)
    }

    // ---- foreground + notifications -------------------------------------

    private fun startAsForeground() {
        ensureChannels()
        val tapIntent = PendingIntent.getActivity(
            this, 0,
            packageManager.getLaunchIntentForPackage(packageName)
                ?: Intent(this, ReenableActivity::class.java),
            pendingFlags()
        )
        val notif = NotificationCompat.Builder(this, CHANNEL_PERSISTENT)
            .setContentTitle("Gaman protection active")
            .setContentText("Keeping your blocks in place.")
            .setSmallIcon(android.R.drawable.ic_lock_idle_lock)
            .setOngoing(true)
            .setContentIntent(tapIntent)
            .setPriority(NotificationCompat.PRIORITY_MIN)
            .build()

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            val type = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE)
                ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE else 0
            startForeground(PERSISTENT_NOTIF_ID, notif, type)
        } else {
            startForeground(PERSISTENT_NOTIF_ID, notif)
        }
    }

    private fun ensureChannels() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val nm = notificationManager()
        nm.createNotificationChannel(
            NotificationChannel(
                CHANNEL_PERSISTENT, "Gaman protection",
                NotificationManager.IMPORTANCE_MIN
            ).apply { description = "Shows that blocking is active." }
        )
        nm.createNotificationChannel(
            NotificationChannel(
                CHANNEL_ALERT, "Protection turned off",
                NotificationManager.IMPORTANCE_HIGH
            ).apply { description = "Alerts you when Gaman is disabled." }
        )
    }

    private fun notificationManager() =
        getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

    private fun pendingFlags(): Int =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M)
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        else PendingIntent.FLAG_UPDATE_CURRENT

    companion object {
        // Channel ids predate the rename; kept so existing notification settings carry over.
        private const val CHANNEL_PERSISTENT = "sitelock_watchdog"
        private const val CHANNEL_ALERT = "sitelock_alert"
        private const val CHANNEL_GUARD = "sitelock_guard"
        private const val PERSISTENT_NOTIF_ID = 1001
        private const val ALERT_NOTIF_ID = 1002
        private const val GUARD_NOTIF_ID = 1004
        private const val POLL_INTERVAL_MS = 1000L
        private const val RE_ALERT_MS = 60_000L // re-pop the warning every minute while off

        /** Live state for the status panel. */
        val isRunning = java.util.concurrent.atomic.AtomicBoolean(false)
        @Volatile var lastDisableAt = 0L

        /** Show the re-enable screen on demand (used by the in-app "Test" button). */
        fun showReenableNow(context: Context) {
            val intent = Intent(context.applicationContext, ReenableActivity::class.java)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)
            context.applicationContext.startActivity(intent)
        }

        /**
         * Fire the "protection was turned off" alert from ANY context (e.g. the
         * accessibility service's onUnbind, which reliably fires on disable).
         * Posts a high-priority full-screen-intent notification — the one path
         * Android does NOT block from the background — and also attempts a direct
         * launch. Works even when a background activity-start is blocked.
         */
        fun fireAlert(context: Context) {
            val ctx = context.applicationContext
            lastDisableAt = System.currentTimeMillis()

            val nm = ctx.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                nm.createNotificationChannel(
                    NotificationChannel(CHANNEL_ALERT, "Protection turned off", NotificationManager.IMPORTANCE_HIGH)
                        .apply { description = "Alerts you when Gaman is disabled." }
                )
            }

            val reenable = Intent(ctx, ReenableActivity::class.java)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)

            val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M)
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            else PendingIntent.FLAG_UPDATE_CURRENT
            val pi = PendingIntent.getActivity(ctx, 1, reenable, flags)

            val notif = NotificationCompat.Builder(ctx, CHANNEL_ALERT)
                .setContentTitle("Gaman was turned off")
                .setContentText("Tap to turn protection back on.")
                .setSmallIcon(android.R.drawable.stat_sys_warning)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setCategory(NotificationCompat.CATEGORY_ALARM)
                .setOngoing(true)
                .setAutoCancel(false)
                .setContentIntent(pi)
                .setFullScreenIntent(pi, true)
                .build()
            nm.notify(ALERT_NOTIF_ID, notif)

            // Best-effort direct launch too (works if background start is allowed).
            try { ctx.startActivity(reenable) } catch (_: Exception) {}
        }

        /**
         * Show the "stay on track" guard screen when the user reaches Gaman's
         * accessibility toggle page. Uses a full-screen-intent notification (the
         * path that is NOT blocked from the background) plus a best-effort launch.
         * Auto-cancels, unlike the persistent "turned off" alert.
         */
        fun fireGuard(context: Context) {
            val ctx = context.applicationContext
            val nm = ctx.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                nm.createNotificationChannel(
                    NotificationChannel(CHANNEL_GUARD, "Settings guard", NotificationManager.IMPORTANCE_HIGH)
                        .apply { description = "Blocks the Gaman disable page while active." }
                )
            }
            val guard = Intent(ctx, GuardActivity::class.java)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)
            val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M)
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            else PendingIntent.FLAG_UPDATE_CURRENT
            val pi = PendingIntent.getActivity(ctx, 2, guard, flags)

            val notif = NotificationCompat.Builder(ctx, CHANNEL_GUARD)
                .setContentTitle("Gaman is protecting you")
                .setContentText("You can’t disable it here right now.")
                .setSmallIcon(android.R.drawable.ic_lock_idle_lock)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setCategory(NotificationCompat.CATEGORY_ALARM)
                .setAutoCancel(true)
                .setContentIntent(pi)
                .setFullScreenIntent(pi, true)
                .build()
            nm.notify(GUARD_NOTIF_ID, notif)

            try { ctx.startActivity(guard) } catch (_: Exception) {}
        }

        /** Remove the "turned off" alert (called when the service reconnects). */
        fun clearAlert(context: Context) {
            val nm = context.applicationContext
                .getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            nm.cancel(ALERT_NOTIF_ID)
        }

        /** Idempotently (re)start the watchdog as a foreground service. */
        fun ensureRunning(context: Context) {
            val intent = Intent(context.applicationContext, WatchdogService::class.java)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.applicationContext.startForegroundService(intent)
            } else {
                context.applicationContext.startService(intent)
            }
        }
    }
}
