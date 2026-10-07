package com.sitelock

import android.accessibilityservice.AccessibilityService
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.os.Build
import android.util.Log
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import java.time.LocalDate
import java.time.LocalTime
import java.time.format.DateTimeFormatter

class BlockAccessibilityService : AccessibilityService() {

    data class BlockedWebsite(
        val days: String,
        val time: String,
        val websiteUrl: String,
        val visible: Boolean
    )

    /** A blocked site with its schedule parsed once, when the list is loaded. */
    private class ParsedBlock(
        val url: String,
        val days: Set<String>,
        val start: LocalTime?,
        val end: LocalTime?
    ) {
        fun isActive(day: String, now: LocalTime): Boolean {
            if (day !in days) return false
            // No usable time range (empty, "All Day Long", malformed) = all day.
            if (start == null || end == null) return true
            // Start is inclusive, end exclusive; ranges may wrap past midnight.
            return if (start <= end) {
                !now.isBefore(start) && now.isBefore(end)
            } else {
                !now.isBefore(start) || now.isBefore(end)
            }
        }
    }

    // Default to an empty list to avoid UninitializedPropertyAccessException crashes
    private var blockedList: List<ParsedBlock> = emptyList()
    private lateinit var sharedPref: SharedPreferences

    private var lastProcessedTime: Long = 0
    private var lastGuardTime: Long = 0

    companion object {
        private const val TAG = "BlockedService"
        private const val PREFS_NAME = "BlockedPrefs"
        private const val KEY_BLOCKED = "@blocked_websites"
        private const val FULL_WEEK = "Full Week"
        private const val ALL_DAY = "All Day Long"
        private const val APP_NAME = "SiteLock"
        private const val DEBOUNCE_INTERVAL = 500L
        private const val GUARD_DEBOUNCE = 1500L
        private const val MAX_DETAIL_CLICKABLE = 3
        private const val MAX_TREE_DEPTH = 40

        private val gson = Gson()
        private val listType = object : TypeToken<List<BlockedWebsite>>() {}.type
        private val timeFormatter = DateTimeFormatter.ofPattern("HH:mm")
        private val timePattern = Regex("""^\d{2}:\d{2}\s*-\s*\d{2}:\d{2}$""")
        private val ALL_DAYS = setOf("mon", "tue", "wed", "thu", "fri", "sat", "sun")
        private val BROWSER_PACKAGES = setOf(
            "com.android.chrome",
            "org.mozilla.firefox",
            "com.brave.browser",
            "com.opera.browser"
        )
    }

    private val prefsListener = SharedPreferences.OnSharedPreferenceChangeListener { _, key ->
        if (key == KEY_BLOCKED) {
            loadBlockedList()
        }
    }

    override fun onServiceConnected() {
        super.onServiceConnected()
        sharedPref = applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        sharedPref.registerOnSharedPreferenceChangeListener(prefsListener)
        loadBlockedList()

        // Start the independent watchdog. From this moment, if the user ever
        // disables this service, the watchdog (a separate foreground service
        // that disabling accessibility does NOT kill) notices immediately via
        // Settings.Secure and prompts them to turn it back on.
        WatchdogService.ensureRunning(applicationContext)
        // If a "turned off" alert was showing, the service is back — clear it.
        WatchdogService.clearAlert(applicationContext)
    }

    override fun onUnbind(intent: Intent?): Boolean {
        // Called the moment the user switches our service OFF — a reliable signal
        // on every OEM/language (no UI-text parsing). Launch the re-enable warning
        // screen directly from here (the same screen the in-app Test uses). We do
        // NOT send the user home anymore — that was closing the warning before it
        // could show.
        // Fire the alert from here: a full-screen-intent notification that Android
        // does NOT block from the background, plus a best-effort direct launch.
        try {
            WatchdogService.fireAlert(applicationContext)
        } catch (_: Exception) { }
        WatchdogService.ensureRunning(applicationContext)
        return super.onUnbind(intent)
    }

    override fun onDestroy() {
        super.onDestroy()
        if (::sharedPref.isInitialized) {
            sharedPref.unregisterOnSharedPreferenceChangeListener(prefsListener)
        }
        // This runs both when the user disables the service AND on ordinary
        // teardown (app update / config change). The watchdog decides what to
        // do by reading the canonical setting, so it only alerts on a real
        // disable. We just make sure the watchdog is alive to make that call.
        WatchdogService.ensureRunning(applicationContext)
    }

    private fun loadBlockedList() {
        // A removed/empty preference means "nothing blocked", not "keep the old list".
        val jsonData = sharedPref.getString(KEY_BLOCKED, null)
        if (jsonData == null) {
            blockedList = emptyList()
            return
        }

        blockedList = try {
            gson.fromJson<List<BlockedWebsite>>(jsonData, listType)
                ?.map(::parseBlock)
                ?: emptyList()
        } catch (e: Exception) {
            Log.e(TAG, "Failed to parse blocked list", e)
            emptyList()
        }
    }

    private fun parseBlock(item: BlockedWebsite): ParsedBlock {
        val days = if (item.days == FULL_WEEK) {
            ALL_DAYS
        } else {
            item.days.split(",").map { it.trim().trim('\'').lowercase() }.toSet()
        }

        var start: LocalTime? = null
        var end: LocalTime? = null
        if (!item.time.equals(ALL_DAY, ignoreCase = true) && timePattern.matches(item.time)) {
            val (startStr, endStr) = item.time.split("-").map { it.trim() }
            start = LocalTime.parse(startStr, timeFormatter)
            end = LocalTime.parse(endStr, timeFormatter)
        }
        return ParsedBlock(item.websiteUrl, days, start, end)
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        if (event == null) return

        val packageName = event.packageName?.toString() ?: return

        if (isSettingsPackage(packageName)) {
            handleSettingsGuard()
            return
        }

        // Debounce browser evaluation
        if (System.currentTimeMillis() - lastProcessedTime < DEBOUNCE_INTERVAL) return
        if (!isBrowser(packageName)) return

        val rootNode = rootInActiveWindow ?: return
        try {
            val blocked = findBlockedMatch(rootNode) ?: return
            lastProcessedTime = System.currentTimeMillis()
            startBlockedActivity(blocked.url, packageName)
        } finally {
            rootNode.recycleCompat()
        }
    }

    // ---- Anti-disable guard ------------------------------------------------
    // This only runs while our service is ENABLED (the service isn't alive
    // otherwise), so it prevents reaching the OFF toggle without ever
    // blocking the user from turning the service ON.
    //
    // Universal detection: the Settings app is in front AND the screen shows
    // our app's name "SiteLock". The app name is a brand string — identical
    // on every OEM and in every language — so this works everywhere, unlike
    // matching localized phrases or OEM-specific view IDs.
    //
    // Fire only on SiteLock's OWN on/off page, not the full accessibility
    // list. Signals (all structural, OEM/language-neutral):
    //   • "SiteLock" is shown, AND
    //   • there's a toggle, AND
    //   • there are FEW clickable rows. The list is many tappable rows
    //     (one per app + categories) so it's excluded by its length; a
    //     detail page has just a handful of controls.
    private fun handleSettingsGuard() {
        if (System.currentTimeMillis() - lastGuardTime <= GUARD_DEBOUNCE) return
        val root = rootInActiveWindow ?: return
        try {
            val matches = root.findAccessibilityNodeInfosByText(APP_NAME).orEmpty()
            val siteLockShown = matches.isNotEmpty()
            matches.forEach { it.recycleCompat() }

            if (siteLockShown &&
                countToggles(root, 0) >= 1 &&
                countClickable(root, 0) <= MAX_DETAIL_CLICKABLE
            ) {
                lastGuardTime = System.currentTimeMillis()
                WatchdogService.fireGuard(applicationContext)
            }
        } finally {
            root.recycleCompat()
        }
    }

    /** First scheduled-active blocked site whose URL is shown in an unfocused URL bar. */
    private fun findBlockedMatch(root: AccessibilityNodeInfo): ParsedBlock? {
        val currentDay = LocalDate.now().dayOfWeek.name.take(3).lowercase()
        val now = LocalTime.now()

        for (item in blockedList) {
            if (!item.isActive(currentDay, now)) continue

            val matchingNodes = root.findAccessibilityNodeInfosByText(item.url).orEmpty()
            val valid = matchingNodes.any { node ->
                node.className == "android.widget.EditText" && !node.isFocused
            }
            matchingNodes.forEach { it.recycleCompat() }
            if (valid) return item
        }
        return null
    }

    override fun onInterrupt() {
        // Handle service interruption if needed
    }

    /** Number of clickable elements on screen (rows, buttons, switches). */
    private fun countClickable(node: AccessibilityNodeInfo, depth: Int): Int {
        if (depth > MAX_TREE_DEPTH) return 0
        var count = if (node.isClickable) 1 else 0
        for (i in 0 until node.childCount) {
            val child = node.getChild(i) ?: continue
            count += countClickable(child, depth + 1)
            child.recycleCompat()
        }
        return count
    }

    private fun countToggles(node: AccessibilityNodeInfo, depth: Int): Int {
        if (depth > MAX_TREE_DEPTH) return 0
        var count = 0
        val cn = node.className?.toString() ?: ""
        if (node.isCheckable || cn.contains("Switch", true) || cn.contains("Toggle", true)) {
            count++
        }
        for (i in 0 until node.childCount) {
            val child = node.getChild(i) ?: continue
            count += countToggles(child, depth + 1)
            child.recycleCompat()
        }
        return count
    }

    private fun isSettingsPackage(packageName: String): Boolean {
        // Stock is com.android.settings; some OEMs vary, so also accept any
        // package whose name contains "settings". Never our own package.
        if (packageName == applicationContext.packageName) return false
        return packageName == "com.android.settings" ||
            packageName.contains("settings", ignoreCase = true)
    }

    private fun isBrowser(packageName: String?): Boolean =
        packageName != null && packageName in BROWSER_PACKAGES

    /** Nodes only need recycling before API 33; it is a no-op afterwards. */
    @Suppress("DEPRECATION")
    private fun AccessibilityNodeInfo.recycleCompat() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) recycle()
    }

    private fun startBlockedActivity(url: String, packageName: String) {
        val intent = Intent()
        intent.setClassName(applicationContext.packageName, BlockedPageActivity::class.java.name)
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        intent.putExtra("blocked_url", url)
        intent.putExtra("package_name", packageName)
        applicationContext.startActivity(intent)
    }
}
