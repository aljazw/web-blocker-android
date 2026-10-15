package com.gaman.music

import android.content.ComponentName
import android.content.ContentUris
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.provider.MediaStore
import androidx.media3.common.MediaItem
import androidx.media3.common.MediaMetadata
import androidx.media3.common.Player
import androidx.media3.session.MediaController
import androidx.media3.session.SessionToken
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.google.common.util.concurrent.ListenableFuture
import org.json.JSONArray
import org.json.JSONObject
import java.util.concurrent.Executor

/**
 * JS bridge for [MusicService]: lists the songs on the phone and drives the
 * player through a Media3 controller. State goes to JS as a JSON string in a
 * "MusicState" event on every change; JS moves the position along between them.
 */
class MusicModule(private val ctx: ReactApplicationContext) : ReactContextBaseJavaModule(ctx) {

    override fun getName(): String = "Music"

    private val main = Handler(Looper.getMainLooper())
    private val mainExecutor = Executor { main.post(it) }
    private var controller: ListenableFuture<MediaController>? = null

    private val listener = object : Player.Listener {
        override fun onEvents(player: Player, events: Player.Events) = emit(player)
    }

    /** Every song on the phone, by title. Runs off the main thread; large libraries take a moment. */
    @ReactMethod
    fun getLibrary(promise: Promise) {
        Thread {
            try {
                promise.resolve(queryLibrary().toString())
            } catch (e: SecurityException) {
                promise.reject("music_permission", e.message, e)
            } catch (e: Exception) {
                promise.reject("music_error", e.message, e)
            }
        }.start()
    }

    /** Plays `tracksJson` (from [getLibrary]) as the queue, starting at `index`. */
    @ReactMethod
    fun play(tracksJson: String, index: Int, shuffle: Boolean, promise: Promise) = withPlayer(promise) {
        val tracks = JSONArray(tracksJson)
        val items = (0 until tracks.length()).map { toMediaItem(tracks.getJSONObject(it)) }
        it.shuffleModeEnabled = shuffle
        it.setMediaItems(items, index.coerceIn(0, maxOf(0, items.size - 1)), 0)
        it.prepare()
        it.play()
    }

    @ReactMethod
    fun toggle(promise: Promise) = withPlayer(promise) {
        if (it.isPlaying) {
            it.pause()
        } else {
            if (it.playbackState == Player.STATE_ENDED) it.seekToDefaultPosition(0)
            if (it.playbackState == Player.STATE_IDLE) it.prepare()
            it.play()
        }
    }

    @ReactMethod
    fun next(promise: Promise) = withPlayer(promise) { it.seekToNext() }

    /** Back to the start of the song, or the song before when it has just started. */
    @ReactMethod
    fun previous(promise: Promise) = withPlayer(promise) { it.seekToPrevious() }

    @ReactMethod
    fun seekTo(positionMs: Double, promise: Promise) = withPlayer(promise) { it.seekTo(positionMs.toLong()) }

    @ReactMethod
    fun setShuffle(enabled: Boolean, promise: Promise) = withPlayer(promise) { it.shuffleModeEnabled = enabled }

    /** "off", "all" or "one". */
    @ReactMethod
    fun setRepeat(mode: String, promise: Promise) = withPlayer(promise) {
        it.repeatMode = when (mode) {
            "all" -> Player.REPEAT_MODE_ALL
            "one" -> Player.REPEAT_MODE_ONE
            else -> Player.REPEAT_MODE_OFF
        }
    }

    /** Stops and clears the queue, which also removes the notification. */
    @ReactMethod
    fun stop(promise: Promise) = withPlayer(promise) {
        it.stop()
        it.clearMediaItems()
    }

    @ReactMethod
    fun getState(promise: Promise) = withPlayer(promise) { }

    // NativeEventEmitter needs these two.
    @ReactMethod
    fun addListener(eventName: String) = Unit

    @ReactMethod
    fun removeListeners(count: Double) = Unit

    override fun invalidate() {
        val future = controller
        controller = null
        main.post {
            future?.let { f ->
                if (f.isDone) runCatching { f.get().run { removeListener(listener); release() } }
                else f.cancel(true)
            }
        }
        super.invalidate()
    }

    /** Runs `block` on the main thread with a connected controller, then resolves with the state. */
    private fun withPlayer(promise: Promise, block: (MediaController) -> Unit) {
        main.post {
            val future = controller ?: MediaController.Builder(
                ctx,
                SessionToken(ctx, ComponentName(ctx, MusicService::class.java)),
            ).buildAsync().also { f ->
                controller = f
                f.addListener({ runCatching { f.get().addListener(listener) } }, mainExecutor)
            }
            future.addListener({
                try {
                    val player = future.get()
                    block(player)
                    promise.resolve(state(player).toString())
                } catch (e: Exception) {
                    // A dead connection is rebuilt on the next call.
                    if (controller === future) controller = null
                    promise.reject("music_error", e.message, e)
                }
            }, mainExecutor)
        }
    }

    private fun emit(player: Player) {
        if (ctx.hasActiveReactInstance()) {
            ctx.emitDeviceEvent("MusicState", state(player).toString())
        }
    }

    private fun state(player: Player): JSONObject {
        val item = player.currentMediaItem
        val meta = item?.mediaMetadata
        return JSONObject().apply {
            put("trackId", item?.mediaId ?: "")
            put("title", meta?.title?.toString() ?: "")
            put("artist", meta?.artist?.toString() ?: "")
            put("playing", player.isPlaying)
            // Playing, or about to (buffering); the button shows pause either way.
            put("playWhenReady", player.playWhenReady && player.playbackState != Player.STATE_ENDED)
            put("positionMs", player.currentPosition)
            put("durationMs", player.duration.takeIf { it > 0 } ?: 0L)
            put("index", player.currentMediaItemIndex)
            put("count", player.mediaItemCount)
            put("shuffle", player.shuffleModeEnabled)
            put(
                "repeat",
                when (player.repeatMode) {
                    Player.REPEAT_MODE_ALL -> "all"
                    Player.REPEAT_MODE_ONE -> "one"
                    else -> "off"
                },
            )
            put("at", System.currentTimeMillis())
        }
    }

    private fun toMediaItem(track: JSONObject): MediaItem {
        val albumId = track.optLong("albumId", -1)
        val meta = MediaMetadata.Builder()
            .setTitle(track.optString("title"))
            .setArtist(track.optString("artist"))
            .setAlbumTitle(track.optString("album"))
            .apply {
                if (albumId >= 0) setArtworkUri(ContentUris.withAppendedId(ALBUM_ART, albumId))
            }
            .build()
        return MediaItem.Builder()
            .setMediaId(track.getString("id"))
            .setUri(track.getString("uri"))
            .setMediaMetadata(meta)
            .build()
    }

    private fun queryLibrary(): JSONArray {
        val songs = JSONArray()
        val collection = MediaStore.Audio.Media.EXTERNAL_CONTENT_URI
        val columns = arrayOf(
            MediaStore.Audio.Media._ID,
            MediaStore.Audio.Media.TITLE,
            MediaStore.Audio.Media.ARTIST,
            MediaStore.Audio.Media.ALBUM,
            MediaStore.Audio.Media.ALBUM_ID,
            MediaStore.Audio.Media.DURATION,
        )
        // Songs only: no ringtones, notification sounds or voice notes.
        val selection = "${MediaStore.Audio.Media.IS_MUSIC} != 0"
        ctx.contentResolver.query(collection, columns, selection, null, "${MediaStore.Audio.Media.TITLE} COLLATE NOCASE")
            ?.use { c ->
                val id = c.getColumnIndexOrThrow(MediaStore.Audio.Media._ID)
                val title = c.getColumnIndexOrThrow(MediaStore.Audio.Media.TITLE)
                val artist = c.getColumnIndexOrThrow(MediaStore.Audio.Media.ARTIST)
                val album = c.getColumnIndexOrThrow(MediaStore.Audio.Media.ALBUM)
                val albumId = c.getColumnIndexOrThrow(MediaStore.Audio.Media.ALBUM_ID)
                val duration = c.getColumnIndexOrThrow(MediaStore.Audio.Media.DURATION)
                while (c.moveToNext()) {
                    val songId = c.getLong(id)
                    songs.put(
                        JSONObject()
                            .put("id", songId.toString())
                            .put("uri", ContentUris.withAppendedId(collection, songId).toString())
                            .put("title", c.getString(title) ?: "")
                            .put("artist", c.getString(artist)?.takeUnless { it == MediaStore.UNKNOWN_STRING } ?: "")
                            .put("album", c.getString(album) ?: "")
                            .put("albumId", c.getLong(albumId))
                            .put("durationMs", c.getLong(duration)),
                    )
                }
            }
        return songs
    }

    private companion object {
        val ALBUM_ART: Uri = Uri.parse("content://media/external/audio/albumart")
    }
}
