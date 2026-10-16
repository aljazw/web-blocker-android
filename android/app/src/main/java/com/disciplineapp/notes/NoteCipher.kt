package com.disciplineapp.notes

import java.nio.charset.StandardCharsets
import java.security.SecureRandom
import java.text.Normalizer
import javax.crypto.AEADBadTagException
import javax.crypto.Cipher
import javax.crypto.Mac
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.SecretKeySpec

/**
 * The cryptography behind protected notes, with no Android dependencies so it
 * can be unit tested on the JVM.
 *
 * One random 256-bit data key encrypts every protected note (AES-256-GCM).
 * The data key itself is stored only wrapped (encrypted) with a key derived
 * from the user's password (PBKDF2-HMAC-SHA256, random salt). The password is
 * never stored, so nothing on the phone or in a backup reveals it or the notes;
 * changing the password only re-wraps the data key.
 *
 * PBKDF2 is implemented here instead of using SecretKeyFactory: that one is
 * missing before Android 8 and providers disagree on how they encode the
 * password, which would make a backup unreadable on another phone.
 */
object NoteCipher {
    const val KEY_BYTES = 32
    const val SALT_BYTES = 16
    const val IV_BYTES = 12
    const val TAG_BITS = 128
    /** Each password guess costs this many HMAC rounds; stored per vault so it can be raised later. */
    const val ITERATIONS = 310_000

    /** Binds the wrapped key to its purpose, so a note's ciphertext can't be passed off as the key. */
    private val WRAP_AAD = "discipline-app-notes-key-v1".toByteArray(StandardCharsets.UTF_8)

    private val random = SecureRandom()

    class WrongPassword : Exception("Wrong password")

    fun randomBytes(size: Int): ByteArray = ByteArray(size).also { random.nextBytes(it) }

    /** The same password always gives the same bytes, whatever keyboard typed it. */
    fun passwordBytes(password: String): ByteArray =
        Normalizer.normalize(password, Normalizer.Form.NFC).toByteArray(StandardCharsets.UTF_8)

    /** PBKDF2-HMAC-SHA256 (RFC 8018). */
    fun pbkdf2(password: ByteArray, salt: ByteArray, iterations: Int, length: Int): ByteArray {
        require(iterations > 0 && length > 0)
        val mac = Mac.getInstance("HmacSHA256")
        // An empty HMAC key is valid but SecretKeySpec refuses it; HMAC pads keys with zeros anyway.
        mac.init(SecretKeySpec(if (password.isEmpty()) ByteArray(1) else password, "HmacSHA256"))
        val hLen = mac.macLength
        val out = ByteArray(length)
        val u = ByteArray(hLen)
        val t = ByteArray(hLen)
        var block = 1
        var offset = 0
        while (offset < length) {
            mac.update(salt)
            mac.update(byteArrayOf((block ushr 24).toByte(), (block ushr 16).toByte(), (block ushr 8).toByte(), block.toByte()))
            mac.doFinal(u, 0)
            u.copyInto(t)
            for (i in 1 until iterations) {
                mac.update(u)
                mac.doFinal(u, 0)
                for (j in 0 until hLen) t[j] = (t[j].toInt() xor u[j].toInt()).toByte()
            }
            val n = minOf(hLen, length - offset)
            t.copyInto(out, offset, 0, n)
            offset += n
            block++
        }
        u.fill(0)
        t.fill(0)
        return out
    }

    /** AES-256-GCM: returns iv || ciphertext || tag. */
    fun seal(key: ByteArray, plain: ByteArray, aad: ByteArray): ByteArray {
        val iv = randomBytes(IV_BYTES)
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.ENCRYPT_MODE, SecretKeySpec(key, "AES"), GCMParameterSpec(TAG_BITS, iv))
        cipher.updateAAD(aad)
        return iv + cipher.doFinal(plain)
    }

    /** Reverses [seal]; throws AEADBadTagException if the key is wrong or the data was changed. */
    fun open(key: ByteArray, sealed: ByteArray, aad: ByteArray): ByteArray {
        require(sealed.size > IV_BYTES + TAG_BITS / 8) { "Damaged data" }
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.DECRYPT_MODE, SecretKeySpec(key, "AES"), GCMParameterSpec(TAG_BITS, sealed, 0, IV_BYTES))
        cipher.updateAAD(aad)
        return cipher.doFinal(sealed, IV_BYTES, sealed.size - IV_BYTES)
    }

    /** A wrapped data key: everything needed to unlock it again with the password. */
    class Vault(val iterations: Int, val salt: ByteArray, val wrapped: ByteArray)

    /** Wraps `dataKey` with a key derived from `password`, using a fresh salt. */
    fun wrap(dataKey: ByteArray, password: String, iterations: Int = ITERATIONS): Vault {
        val salt = randomBytes(SALT_BYTES)
        val pw = passwordBytes(password)
        val kek = pbkdf2(pw, salt, iterations, KEY_BYTES)
        try {
            return Vault(iterations, salt, seal(kek, dataKey, WRAP_AAD))
        } finally {
            pw.fill(0)
            kek.fill(0)
        }
    }

    /** The data key, or [WrongPassword]. */
    fun unwrap(vault: Vault, password: String): ByteArray {
        val pw = passwordBytes(password)
        val kek = pbkdf2(pw, vault.salt, vault.iterations, KEY_BYTES)
        try {
            return open(kek, vault.wrapped, WRAP_AAD)
        } catch (e: AEADBadTagException) {
            throw WrongPassword()
        } finally {
            pw.fill(0)
            kek.fill(0)
        }
    }
}
