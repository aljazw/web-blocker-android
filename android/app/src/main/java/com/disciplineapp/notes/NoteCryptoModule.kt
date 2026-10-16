package com.disciplineapp.notes

import android.os.Handler
import android.os.Looper
import android.util.Base64
import android.view.WindowManager
import com.facebook.react.bridge.LifecycleEventListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.UiThreadUtil
import org.json.JSONObject
import java.nio.charset.StandardCharsets
import java.util.concurrent.Executors

/**
 * Bridge for protected notes (see [NoteCipher]).
 *
 * The data key never crosses to JavaScript: it lives only in this module's
 * memory while the notes are unlocked, and JS asks for single notes to be
 * encrypted or decrypted. Locking (or the process dying) forgets it.
 *
 * The vault (salt + wrapped key) is stored by JS as JSON:
 *   {"v":1,"kdf":"pbkdf2-sha256","iter":310000,"salt":"<b64>","key":"<b64>"}
 * A note's ciphertext is base64 of iv || ciphertext || tag, bound to its id.
 */
class NoteCryptoModule(private val ctx: ReactApplicationContext) :
    ReactContextBaseJavaModule(ctx), LifecycleEventListener {

    override fun getName(): String = "NoteCrypto"

    /** Key derivation takes a moment; keep it off the bridge thread and run one job at a time. */
    private val worker = Executors.newSingleThreadExecutor()
    private val main = Handler(Looper.getMainLooper())

    @Volatile
    private var dataKey: ByteArray? = null

    /** A delayed lock, queued behind running jobs so an unlock in progress can't undo it. */
    private val lockTask = Runnable { if (!worker.isShutdown) worker.execute { forget() } }

    init {
        ctx.addLifecycleEventListener(this)
    }

    private fun forget() {
        dataKey?.fill(0)
        dataKey = null
    }

    private fun run(promise: Promise, job: () -> Any?) {
        worker.execute {
            try {
                promise.resolve(job())
            } catch (e: NoteCipher.WrongPassword) {
                promise.reject("WRONG_PASSWORD", "Wrong password")
            } catch (e: Exception) {
                promise.reject("CRYPTO_ERROR", e.message ?: "Encryption failed", e)
            }
        }
    }

    private fun b64(bytes: ByteArray) = Base64.encodeToString(bytes, Base64.NO_WRAP)
    private fun unb64(text: String) = Base64.decode(text, Base64.NO_WRAP)

    private fun toJson(vault: NoteCipher.Vault): String =
        JSONObject()
            .put("v", 1)
            .put("kdf", "pbkdf2-sha256")
            .put("iter", vault.iterations)
            .put("salt", b64(vault.salt))
            .put("key", b64(vault.wrapped))
            .toString()

    private fun fromJson(json: String): NoteCipher.Vault {
        val o = JSONObject(json)
        require(o.optInt("v") == 1 && o.optString("kdf") == "pbkdf2-sha256") { "Unknown vault format" }
        val iterations = o.getInt("iter")
        require(iterations in 1..10_000_000) { "Bad vault" }
        return NoteCipher.Vault(iterations, unb64(o.getString("salt")), unb64(o.getString("key")))
    }

    private fun aad(id: String) = "note:$id".toByteArray(StandardCharsets.UTF_8)

    private fun key(): ByteArray = dataKey ?: throw IllegalStateException("LOCKED")

    /** Creates a new data key protected by `password`; resolves the vault JSON and stays unlocked. */
    @ReactMethod
    fun createVault(password: String, promise: Promise) = run(promise) {
        val key = NoteCipher.randomBytes(NoteCipher.KEY_BYTES)
        val json = toJson(NoteCipher.wrap(key, password))
        forget()
        dataKey = key
        json
    }

    /** Resolves true and stays unlocked, or false for a wrong password. */
    @ReactMethod
    fun unlock(vault: String, password: String, promise: Promise) = run(promise) {
        try {
            val key = NoteCipher.unwrap(fromJson(vault), password)
            forget()
            dataKey = key
            true
        } catch (e: NoteCipher.WrongPassword) {
            false
        }
    }

    /** Re-wraps the same data key under a new password: resolves the new vault JSON, or null if `current` is wrong. */
    @ReactMethod
    fun changePassword(vault: String, current: String, next: String, promise: Promise) = run(promise) {
        try {
            val key = NoteCipher.unwrap(fromJson(vault), current)
            val json = toJson(NoteCipher.wrap(key, next))
            forget()
            dataKey = key
            json
        } catch (e: NoteCipher.WrongPassword) {
            null
        }
    }

    @ReactMethod
    fun encrypt(plain: String, id: String, promise: Promise) = run(promise) {
        b64(NoteCipher.seal(key(), plain.toByteArray(StandardCharsets.UTF_8), aad(id)))
    }

    @ReactMethod
    fun decrypt(sealed: String, id: String, promise: Promise) = run(promise) {
        String(NoteCipher.open(key(), unb64(sealed), aad(id)), StandardCharsets.UTF_8)
    }

    @ReactMethod
    fun isUnlocked(promise: Promise) = run(promise) { dataKey != null }

    /** Forgets the key now. */
    @ReactMethod
    fun lock() {
        main.removeCallbacks(lockTask)
        lockTask.run()
    }

    /** Forgets the key after `ms` unless [cancelLock] comes first; for when the app goes to the background. */
    @ReactMethod
    fun lockAfter(ms: Double) {
        main.removeCallbacks(lockTask)
        main.postDelayed(lockTask, ms.toLong())
    }

    @ReactMethod
    fun cancelLock() {
        main.removeCallbacks(lockTask)
    }

    /** Keeps the screen out of screenshots and the recent-apps preview while notes are readable. */
    @ReactMethod
    fun setSecure(secure: Boolean) {
        UiThreadUtil.runOnUiThread {
            val window = ctx.currentActivity?.window ?: return@runOnUiThread
            if (secure) {
                window.addFlags(WindowManager.LayoutParams.FLAG_SECURE)
            } else {
                window.clearFlags(WindowManager.LayoutParams.FLAG_SECURE)
            }
        }
    }

    override fun onHostResume() {}

    override fun onHostPause() {}

    override fun onHostDestroy() {
        lock()
    }

    override fun invalidate() {
        ctx.removeLifecycleEventListener(this)
        main.removeCallbacks(lockTask)
        forget()
        worker.shutdown()
        super.invalidate()
    }
}
