package com.sitelock.apnea

import org.json.JSONArray
import org.json.JSONObject
import kotlin.math.ceil

/** One step of a session. A negative [durationMs] means open-ended: it ends when the user taps. */
data class Phase(val type: String, val durationMs: Long, val round: Int) {
    val isHold get() = type == HOLD
    val isOpen get() = durationMs < 0

    /** Apnea phases get countdown ticks; quick breathing-exercise phases only a soft cue. */
    val isApnea get() = type == HOLD || type == BREATHE || type == PREPARE

    fun toJson(): JSONObject = JSONObject().put("type", type).put("durationMs", durationMs).put("round", round)

    companion object {
        const val HOLD = "hold"
        const val BREATHE = "breathe"
        const val PREPARE = "prepare"

        fun fromJson(o: JSONObject) = Phase(o.getString("type"), o.getLong("durationMs"), o.optInt("round", 0))
    }
}

data class CueSettings(val sound: Boolean, val vibration: Boolean, val pulseEveryMs: Long) {
    fun toJson(): JSONObject = JSONObject().put("sound", sound).put("vibration", vibration).put("pulseEveryMs", pulseEveryMs)

    companion object {
        fun fromJson(o: JSONObject?) = CueSettings(
            sound = o?.optBoolean("sound", true) ?: true,
            vibration = o?.optBoolean("vibration", true) ?: true,
            pulseEveryMs = o?.optLong("pulseEveryMs", 0L) ?: 0L,
        )
    }
}

enum class Cue { HOLD, BREATHE, SOFT_CHANGE, TICK, WARNING, PULSE, FINISH }

/**
 * The clock of a running session. All times are SystemClock.elapsedRealtime()
 * millis passed in by the caller, so the logic is deterministic, keeps counting
 * while the phone sleeps, and can be persisted and restored after a process kill.
 *
 * Not thread-safe: the service guards every call with its lock.
 */
class Timeline private constructor(
    val id: String,
    val kind: String,
    val title: String,
    /** Opaque JSON from JS (difficulty, table id…), handed back with the result. */
    val meta: String,
    val phases: List<Phase>,
    val cues: CueSettings,
    val startedAtWall: Long,
    index: Int,
    phaseStart: Long,
    pausedAt: Long?,
    /** Actual length of every finished hold, in order. */
    private val holds: MutableList<Long>,
    /** Contraction times (ms into the hold) for every hold started so far. */
    private val contractions: MutableList<MutableList<Long>>,
    finished: Boolean,
    completed: Boolean,
    endedAtWall: Long,
) {
    var index = index; private set
    var phaseStart = phaseStart; private set
    var pausedAt = pausedAt; private set
    var finished = finished; private set
    var completed = completed; private set
    var endedAtWall = endedAtWall; private set

    // Cue de-duplication; never persisted, so a restore can't replay old cues.
    private var lastSecondCued = Long.MIN_VALUE
    private var lastPulse = 0L

    val current: Phase? get() = phases.getOrNull(index)
    val isPaused get() = pausedAt != null

    fun phaseElapsed(now: Long): Long = ((pausedAt ?: now) - phaseStart).coerceAtLeast(0)

    /** Moves past every phase whose time is up and returns the cues to play now. */
    fun tick(now: Long, wallNow: Long): List<Cue> {
        if (finished || isPaused) return emptyList()
        val out = mutableListOf<Cue>()

        while (true) {
            val phase = current ?: break
            if (phase.isOpen || now - phaseStart < phase.durationMs) break
            val endAt = phaseStart + phase.durationMs
            // Transitions caught up after a long stall (e.g. a restore) stay silent.
            val fresh = now - endAt < STALE_MS
            advance(endAt, phase.durationMs, wallNow)
            if (fresh) out += if (finished) Cue.FINISH else startCue(current!!)
            if (finished) return out
        }

        val phase = current ?: return out
        val elapsed = now - phaseStart
        if (phase.isOpen) {
            if (phase.isHold && cues.pulseEveryMs > 0) {
                val pulse = elapsed / cues.pulseEveryMs
                if (pulse > lastPulse) {
                    lastPulse = pulse
                    out += Cue.PULSE
                }
            }
        } else if (phase.isApnea) {
            val secondsLeft = ceil((phase.durationMs - elapsed) / 1000.0).toLong()
            if (secondsLeft != lastSecondCued) {
                lastSecondCued = secondsLeft
                when {
                    secondsLeft in 1..3 && phase.durationMs >= 10_000 -> out += Cue.TICK
                    secondsLeft == 10L && phase.durationMs >= 20_000 -> out += Cue.WARNING
                }
            }
        }
        return out
    }

    /** Ends the current phase now ("End hold" / "Hold now"). */
    fun skip(now: Long, wallNow: Long): List<Cue> {
        if (finished || isPaused) return emptyList()
        advance(now, now - phaseStart, wallNow)
        return listOf(if (finished) Cue.FINISH else startCue(current!!))
    }

    fun pause(now: Long) {
        if (!finished && !isPaused) pausedAt = now
    }

    fun resume(now: Long) {
        val since = pausedAt ?: return
        phaseStart += now - since
        pausedAt = null
    }

    /** Marks a diaphragm contraction in the current hold. */
    fun contraction(now: Long): Boolean {
        if (finished || isPaused || current?.isHold != true) return false
        contractions.last().add(now - phaseStart)
        return true
    }

    /** Stops early. A hold in progress is kept with the time reached. */
    fun stop(now: Long, wallNow: Long) {
        if (finished) return
        if (current?.isHold == true) holds.add(phaseElapsed(now))
        finish(completed = false, wallNow)
    }

    /** The phase to play on start, for the opening cue. */
    fun openingCue(): Cue? = current?.let(::startCue)

    private fun advance(endAt: Long, actualMs: Long, wallNow: Long) {
        if (current?.isHold == true) holds.add(actualMs)
        index++
        phaseStart = endAt
        lastSecondCued = Long.MIN_VALUE
        lastPulse = 0L
        if (index >= phases.size) finish(completed = true, wallNow) else enterPhase()
    }

    private fun enterPhase() {
        if (current?.isHold == true) contractions.add(mutableListOf())
    }

    private fun finish(completed: Boolean, wallNow: Long) {
        finished = true
        this.completed = completed
        endedAtWall = wallNow
        pausedAt = null
    }

    private fun startCue(phase: Phase): Cue = when {
        !phase.isApnea -> Cue.SOFT_CHANGE
        phase.isHold -> Cue.HOLD
        else -> Cue.BREATHE
    }

    /** Full state; also what the UI polls. [now] is used for the derived "live" fields. */
    fun toJson(now: Long, wallNow: Long): JSONObject = JSONObject()
        .put("id", id)
        .put("kind", kind)
        .put("title", title)
        .put("meta", meta)
        .put("phases", JSONArray().apply { phases.forEach { put(it.toJson()) } })
        .put("cues", cues.toJson())
        .put("startedAt", startedAtWall)
        .put("index", index)
        .put("phaseStart", phaseStart)
        .put("pausedAt", pausedAt ?: JSONObject.NULL)
        .put("holds", JSONArray(holds))
        .put("contractions", JSONArray().apply { contractions.forEach { put(JSONArray(it)) } })
        .put("finished", finished)
        .put("completed", completed)
        .put("endedAt", endedAtWall)
        .put("status", if (finished) "finished" else if (isPaused) "paused" else "running")
        .put("phaseElapsedMs", if (finished) 0 else phaseElapsed(now))
        // Lets a restore detect a reboot, which resets elapsedRealtime.
        .put("bootWall", wallNow - now)

    companion object {
        /** Transitions older than this when processed are applied without a cue. */
        private const val STALE_MS = 3_000L

        /** A new session from the JSON the app sends: {id, kind, title, meta, phases, cues}. */
        fun create(json: JSONObject, now: Long, wallNow: Long): Timeline {
            val array = json.getJSONArray("phases")
            val phases = (0 until array.length()).map { Phase.fromJson(array.getJSONObject(it)) }
            require(phases.isNotEmpty()) { "A session needs at least one phase" }
            return Timeline(
                id = json.getString("id"),
                kind = json.optString("kind", "custom"),
                title = json.optString("title", "Session"),
                meta = json.optString("meta", "{}"),
                phases = phases,
                cues = CueSettings.fromJson(json.optJSONObject("cues")),
                startedAtWall = wallNow,
                index = 0,
                phaseStart = now,
                pausedAt = null,
                holds = mutableListOf(),
                contractions = mutableListOf(),
                finished = false,
                completed = false,
                endedAtWall = 0L,
            ).also { it.enterPhase() }
        }

        /** Rebuilds a persisted session, or null if it can't continue (e.g. the phone rebooted). */
        fun restore(json: JSONObject, now: Long, wallNow: Long): Timeline? = runCatching {
            if (kotlin.math.abs((wallNow - now) - json.getLong("bootWall")) > 60_000) return null
            val phaseArray = json.getJSONArray("phases")
            val holdArray = json.getJSONArray("holds")
            val contractionArray = json.getJSONArray("contractions")
            Timeline(
                id = json.getString("id"),
                kind = json.getString("kind"),
                title = json.getString("title"),
                meta = json.optString("meta", "{}"),
                phases = (0 until phaseArray.length()).map { Phase.fromJson(phaseArray.getJSONObject(it)) },
                cues = CueSettings.fromJson(json.optJSONObject("cues")),
                startedAtWall = json.getLong("startedAt"),
                index = json.getInt("index"),
                phaseStart = json.getLong("phaseStart"),
                pausedAt = if (json.isNull("pausedAt")) null else json.getLong("pausedAt"),
                holds = (0 until holdArray.length()).map { holdArray.getLong(it) }.toMutableList(),
                contractions = (0 until contractionArray.length()).map { i ->
                    val inner = contractionArray.getJSONArray(i)
                    (0 until inner.length()).map { inner.getLong(it) }.toMutableList()
                }.toMutableList(),
                finished = json.getBoolean("finished"),
                completed = json.getBoolean("completed"),
                endedAtWall = json.getLong("endedAt"),
            )
        }.getOrNull()
    }
}
