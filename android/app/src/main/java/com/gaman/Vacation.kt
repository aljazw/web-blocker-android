package com.gaman

import android.content.SharedPreferences
import org.json.JSONObject
import java.time.LocalDate

/**
 * Vacation mode: a date range (both days included) when no blocks apply.
 * Written by the JS VacationScreen as JSON under "@vacation" in the shared
 * "BlockedPrefs", e.g. {"start":"2026-10-12","end":"2026-10-20"}, or "null"
 * when there is none.
 */
data class Vacation(val start: LocalDate, val end: LocalDate) {

    fun isActive(today: LocalDate = LocalDate.now()): Boolean =
        !today.isBefore(start) && !today.isAfter(end)

    companion object {
        const val KEY = "@vacation"

        /** Never throws: missing or damaged data means no vacation. */
        fun load(prefs: SharedPreferences): Vacation? {
            val raw = prefs.getString(KEY, null) ?: return null
            return try {
                val json = JSONObject(raw)
                val start = LocalDate.parse(json.getString("start"))
                val end = LocalDate.parse(json.getString("end"))
                if (end.isBefore(start)) null else Vacation(start, end)
            } catch (_: Exception) {
                null
            }
        }
    }
}
