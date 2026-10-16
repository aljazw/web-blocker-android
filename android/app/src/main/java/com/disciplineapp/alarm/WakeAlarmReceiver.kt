package com.disciplineapp.alarm

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/** Rings the wake-up alarm, and re-arms it when the clock or time zone changes. */
class WakeAlarmReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent?) {
        when (intent?.action) {
            ACTION_FIRE -> {
                // Turned off since it was armed: stay quiet.
                if (WakeAlarm.isEnabled(com.disciplineapp.sleep.SleepSchedule.prefs(context))) {
                    WakeAlarmService.start(context)
                }
                WakeAlarm.schedule(context)
            }
            Intent.ACTION_TIME_CHANGED,
            Intent.ACTION_TIMEZONE_CHANGED -> WakeAlarm.schedule(context)
        }
    }

    companion object {
        const val ACTION_FIRE = "com.disciplineapp.alarm.FIRE"
    }
}
