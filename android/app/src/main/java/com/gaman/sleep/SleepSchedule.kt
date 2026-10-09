package com.gaman.sleep

import android.content.Context
import android.content.SharedPreferences
import org.json.JSONObject
import java.time.LocalDateTime
import java.time.LocalTime
import java.time.ZoneId

/**
 * The nightly sleep window, written by the JS SleepScreen as JSON under
 * "@sleep_schedule" in the shared "BlockedPrefs". Between bedtime and wake
 * time every app is covered by [SleepActivity] unless the user turned sleep
 * time off for the night (video + passphrase), stored as an epoch-millis
 * deadline under "@sleep_dismissed_until".
 */
data class SleepSchedule(val enabled: Boolean, val bedtime: LocalTime, val wake: LocalTime) {

    /** Bedtime is inclusive, wake time exclusive; the window usually wraps past midnight. */
    fun isActive(now: LocalTime): Boolean {
        if (!enabled || bedtime == wake) return false
        return if (bedtime < wake) {
            !now.isBefore(bedtime) && now.isBefore(wake)
        } else {
            !now.isBefore(bedtime) || now.isBefore(wake)
        }
    }

    /** The next moment the clock reads the wake time (today or tomorrow). */
    fun nextWake(now: LocalDateTime): LocalDateTime {
        val today = now.toLocalDate().atTime(wake)
        return if (now.isBefore(today)) today else today.plusDays(1)
    }

    companion object {
        const val PREFS_NAME = "BlockedPrefs"
        const val KEY_SCHEDULE = "@sleep_schedule"
        const val KEY_DISMISSED_UNTIL = "@sleep_dismissed_until"

        private val DISABLED = SleepSchedule(false, LocalTime.of(23, 0), LocalTime.of(7, 0))

        fun prefs(context: Context): SharedPreferences =
            context.applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

        /** Never throws: missing or damaged data means sleep time is off. */
        fun load(prefs: SharedPreferences): SleepSchedule {
            val raw = prefs.getString(KEY_SCHEDULE, null) ?: return DISABLED
            return try {
                val json = JSONObject(raw)
                SleepSchedule(
                    enabled = json.optBoolean("enabled", false),
                    bedtime = LocalTime.parse(json.getString("bedtime")),
                    wake = LocalTime.parse(json.getString("wake")),
                )
            } catch (_: Exception) {
                DISABLED
            }
        }

        /** Whether apps should be covered right now. */
        fun isSleepTimeNow(prefs: SharedPreferences, schedule: SleepSchedule = load(prefs)): Boolean =
            !isDismissed(prefs) && schedule.isActive(LocalTime.now())

        /** True while sleep time is turned off for the night. */
        fun isDismissed(prefs: SharedPreferences): Boolean =
            System.currentTimeMillis() < (prefs.getString(KEY_DISMISSED_UNTIL, null)?.toLongOrNull() ?: 0L)

        /** Turns sleep time off until the next wake time. Returns that wake time. */
        fun dismissTonight(context: Context): LocalDateTime {
            val p = prefs(context)
            val wake = load(p).nextWake(LocalDateTime.now())
            val millis = wake.atZone(ZoneId.systemDefault()).toInstant().toEpochMilli()
            p.edit().putString(KEY_DISMISSED_UNTIL, millis.toString()).commit()
            return wake
        }
    }
}
