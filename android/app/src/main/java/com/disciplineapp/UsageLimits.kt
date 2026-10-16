package com.disciplineapp

import android.content.SharedPreferences
import android.util.Log
import org.json.JSONObject
import java.time.LocalDate

/**
 * Today's time spent on blocks that have a daily limit, by usage key
 * ("app:<package>" or "site:<url>"). One thing is timed at a time: whatever
 * limited app or site is on screen. Saved to the shared prefs so the app can
 * show "12 of 30 min used" and the count survives a service restart.
 */
class UsageLimits(private val prefs: SharedPreferences) {

    private var day: String = LocalDate.now().toString()
    private val used = HashMap<String, Long>()

    /** What's being timed now, and since when (wall clock). */
    var activeKey: String? = null
        private set
    private var since = 0L

    init {
        load()
    }

    /** Time used today, including the stretch running right now. */
    fun usedMs(key: String): Long {
        rollOver()
        val running = if (key == activeKey) (System.currentTimeMillis() - since).coerceAtLeast(0) else 0
        return (used[key] ?: 0L) + running
    }

    /** Starts timing `key` (null = nothing limited is on screen), banking the previous stretch. */
    fun track(key: String?) {
        if (key == activeKey) return
        flush()
        activeKey = key
        since = System.currentTimeMillis()
    }

    /** Banks the running stretch and saves. Called on every switch and now and then while timing. */
    fun flush() {
        val now = System.currentTimeMillis()
        val key = activeKey
        rollOver()
        if (key != null) {
            used[key] = (used[key] ?: 0L) + (now - since).coerceAtLeast(0)
        }
        since = now
        save()
    }

    /** A new day starts every limit from zero. */
    private fun rollOver() {
        val today = LocalDate.now().toString()
        if (today != day) {
            day = today
            used.clear()
            since = System.currentTimeMillis()
        }
    }

    private fun load() {
        try {
            val json = JSONObject(prefs.getString(KEY, null) ?: return)
            if (json.optString("day") != day) return
            val map = json.optJSONObject("used") ?: return
            map.keys().forEach { used[it] = map.optLong(it, 0L) }
        } catch (e: Exception) {
            Log.w(TAG, "Could not read limit usage", e)
        }
    }

    private fun save() {
        try {
            val map = JSONObject()
            used.forEach { (k, v) -> map.put(k, v) }
            prefs.edit().putString(KEY, JSONObject().put("day", day).put("used", map).toString()).apply()
        } catch (e: Exception) {
            Log.w(TAG, "Could not save limit usage", e)
        }
    }

    companion object {
        private const val TAG = "UsageLimits"
        const val KEY = "@limit_usage"

        fun appKey(packageName: String) = "app:$packageName"
        fun siteKey(url: String) = "site:$url"
    }
}
