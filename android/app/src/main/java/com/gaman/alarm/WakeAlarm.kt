package com.gaman.alarm

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.os.Build
import com.gaman.sleep.SleepSchedule
import org.json.JSONObject
import java.time.LocalDateTime
import java.time.LocalTime
import java.time.ZoneId

/**
 * The wake-up alarm at the day plan's wake time. The JS side writes the
 * settings to the shared "BlockedPrefs":
 *   - "@plan_prefs"  JSON, "wakeAlarm": true turns the alarm on;
 *   - "@day_hours"   JSON, "wake": "HH:mm" (falls back to sleep time's wake,
 *                    the same fallback as getDayHours in JS).
 * Scheduled with setAlarmClock so it fires on time in Doze, and the system
 * shows it as the next alarm. Re-armed for the next day every time it fires,
 * after a reboot and whenever the settings change.
 */
object WakeAlarm {

    private const val KEY_PLAN_PREFS = "@plan_prefs"
    private const val KEY_DAY_HOURS = "@day_hours"
    private const val REQUEST_FIRE = 7001
    private const val REQUEST_SHOW = 7002

    fun isEnabled(prefs: SharedPreferences): Boolean = try {
        JSONObject(prefs.getString(KEY_PLAN_PREFS, null) ?: "{}").optBoolean("wakeAlarm", false)
    } catch (_: Exception) {
        false
    }

    fun wakeTime(prefs: SharedPreferences): LocalTime = try {
        LocalTime.parse(JSONObject(prefs.getString(KEY_DAY_HOURS, null) ?: "{}").getString("wake"))
    } catch (_: Exception) {
        SleepSchedule.load(prefs).wake
    }

    /** The next moment the clock reads [time], always in the future. */
    fun nextTrigger(time: LocalTime, now: LocalDateTime = LocalDateTime.now()): LocalDateTime {
        val today = now.toLocalDate().atTime(time)
        return if (today.isAfter(now)) today else today.plusDays(1)
    }

    /** Arms (or cancels) the alarm to match the stored settings. Never throws. */
    fun schedule(context: Context) {
        try {
            val prefs = SleepSchedule.prefs(context)
            val am = context.getSystemService(AlarmManager::class.java) ?: return
            val fire = firePendingIntent(context)
            am.cancel(fire)
            if (!isEnabled(prefs)) return

            val at = nextTrigger(wakeTime(prefs)).atZone(ZoneId.systemDefault()).toInstant().toEpochMilli()
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S || am.canScheduleExactAlarms()) {
                am.setAlarmClock(AlarmManager.AlarmClockInfo(at, showPendingIntent(context)), fire)
            } else {
                // Exact alarms denied: still ring, maybe a few minutes late.
                am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, fire)
            }
        } catch (_: Exception) { }
    }

    private fun firePendingIntent(context: Context): PendingIntent =
        PendingIntent.getBroadcast(
            context,
            REQUEST_FIRE,
            Intent(context, WakeAlarmReceiver::class.java).setAction(WakeAlarmReceiver.ACTION_FIRE),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )

    /** Opened when the user taps the next-alarm chip in the status bar or clock app. */
    private fun showPendingIntent(context: Context): PendingIntent? =
        context.packageManager.getLaunchIntentForPackage(context.packageName)?.let {
            PendingIntent.getActivity(context, REQUEST_SHOW, it, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        }
}
