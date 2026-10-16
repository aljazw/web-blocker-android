package com.disciplineapp

import android.app.AlarmManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.SystemClock
import androidx.core.app.NotificationCompat

/**
 * Notices when the accessibility service is switched off and asks the user to
 * turn it back on, without keeping a service running in the background (which
 * Android only allows with a permanent notification).
 *
 * Whenever Android unbinds the accessibility service it schedules a check a few
 * seconds later. Unbinding also happens on shutdown, app updates and process
 * restarts, so the check reads the real setting and only alerts when the
 * service has really stayed off. While it stays off, the alert comes back every
 * minute; once it's back on, the alert is cleared and the checks stop.
 *
 * Honest ceiling: a "Force stop" from App Info cancels the check along with
 * everything else, until the app is opened again. That's an OS guarantee.
 */
object ProtectionAlerts {

    // Channel ids predate the rename; kept so existing notification settings carry over.
    private const val CHANNEL_ALERT = "disciplineapp_alert"
    private const val CHANNEL_GUARD = "disciplineapp_guard"
    private const val ALERT_NOTIF_ID = 1002
    private const val GUARD_NOTIF_ID = 1004
    private const val REQUEST_CHECK = 3001

    /** How long the service must stay off before we call it a real disable. */
    const val OFF_GRACE_MS = 5_000L
    /** Re-show the warning this often while protection stays off. */
    private const val RE_ALERT_MS = 60_000L

    /** When the last "turned off" alert fired, for the status panel. */
    @Volatile var lastDisableAt = 0L

    /** Checks the real setting after [delayMs]. Never throws. */
    fun scheduleCheck(context: Context, delayMs: Long = OFF_GRACE_MS) {
        try {
            val ctx = context.applicationContext
            val am = ctx.getSystemService(AlarmManager::class.java) ?: return
            val at = SystemClock.elapsedRealtime() + delayMs
            val pi = checkIntent(ctx)
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S || am.canScheduleExactAlarms()) {
                am.setExactAndAllowWhileIdle(AlarmManager.ELAPSED_REALTIME_WAKEUP, at, pi)
            } else {
                am.setAndAllowWhileIdle(AlarmManager.ELAPSED_REALTIME_WAKEUP, at, pi)
            }
        } catch (e: Exception) {
            android.util.Log.w("DisciplineAppProtection", "could not schedule the check", e)
        }
    }

    /** Stops the checks and clears the alert: the service is running again. */
    fun onProtectionRestored(context: Context) {
        val ctx = context.applicationContext
        try { ctx.getSystemService(AlarmManager::class.java)?.cancel(checkIntent(ctx)) } catch (_: Exception) {}
        clearAlert(ctx)
        ReenableActivity.dismissIfShowing()
    }

    private fun checkIntent(ctx: Context): PendingIntent =
        PendingIntent.getBroadcast(
            ctx, REQUEST_CHECK, Intent(ctx, ProtectionCheckReceiver::class.java), pendingFlags()
        )

    internal fun check(context: Context) {
        val ctx = context.applicationContext
        when {
            AccessibilityUtils.isServiceEnabled(ctx) -> onProtectionRestored(ctx)
            // Before the first unlock after a reboot the setting can read "off"
            // while Android is still starting its services. Look again later.
            !AccessibilityUtils.isUserUnlocked(ctx) -> scheduleCheck(ctx, RE_ALERT_MS)
            else -> {
                fireAlert(ctx)
                scheduleCheck(ctx, RE_ALERT_MS)
            }
        }
    }

    /** Show the re-enable screen on demand (used by the in-app "Test" button). */
    fun showReenableNow(context: Context) {
        val intent = Intent(context.applicationContext, ReenableActivity::class.java)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)
        context.applicationContext.startActivity(intent)
    }

    /**
     * Fire the "protection was turned off" alert: a high-priority full-screen-
     * intent notification (the one path Android does NOT block from the
     * background) plus a best-effort direct launch.
     */
    fun fireAlert(context: Context) {
        val ctx = context.applicationContext
        lastDisableAt = System.currentTimeMillis()

        val nm = ctx.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            nm.createNotificationChannel(
                NotificationChannel(CHANNEL_ALERT, "Protection turned off", NotificationManager.IMPORTANCE_HIGH)
                    .apply { description = "Alerts you when ${ctx.appName} is disabled." }
            )
        }

        val reenable = Intent(ctx, ReenableActivity::class.java)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)
        val pi = PendingIntent.getActivity(ctx, 1, reenable, pendingFlags())

        val notif = NotificationCompat.Builder(ctx, CHANNEL_ALERT)
            .setContentTitle("${ctx.appName} was turned off")
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

        try { ctx.startActivity(reenable) } catch (_: Exception) {}
    }

    /**
     * Show the "stay on track" guard screen when the user reaches the app's
     * accessibility toggle page. The notification only carries the full-screen
     * intent; GuardActivity removes it as soon as it's on screen.
     */
    fun fireGuard(context: Context) {
        val ctx = context.applicationContext
        val nm = ctx.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            nm.createNotificationChannel(
                NotificationChannel(CHANNEL_GUARD, "Settings guard", NotificationManager.IMPORTANCE_HIGH)
                    .apply { description = "Blocks the ${ctx.appName} disable page while active." }
            )
        }
        val guard = Intent(ctx, GuardActivity::class.java)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)
        val pi = PendingIntent.getActivity(ctx, 2, guard, pendingFlags())

        val notif = NotificationCompat.Builder(ctx, CHANNEL_GUARD)
            .setContentTitle("${ctx.appName} is protecting you")
            .setContentText("You can’t disable it here right now.")
            .setSmallIcon(android.R.drawable.ic_lock_idle_lock)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setAutoCancel(true)
            .setTimeoutAfter(10_000L)
            .setContentIntent(pi)
            .setFullScreenIntent(pi, true)
            .build()
        nm.notify(GUARD_NOTIF_ID, notif)

        try { ctx.startActivity(guard) } catch (_: Exception) {}
    }

    /** Remove the guard's carrier notification once the guard screen is up. */
    fun clearGuard(context: Context) {
        val nm = context.applicationContext
            .getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        nm.cancel(GUARD_NOTIF_ID)
    }

    /** Remove the "turned off" alert. */
    fun clearAlert(context: Context) {
        val nm = context.applicationContext
            .getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        nm.cancel(ALERT_NOTIF_ID)
    }

    private fun pendingFlags(): Int =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M)
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        else PendingIntent.FLAG_UPDATE_CURRENT
}

/** Runs one [ProtectionAlerts] check when its alarm fires. */
class ProtectionCheckReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent?) {
        ProtectionAlerts.check(context)
    }
}
