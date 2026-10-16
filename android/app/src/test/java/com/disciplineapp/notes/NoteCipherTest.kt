package com.disciplineapp.notes

import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.fail
import org.junit.Test
import java.nio.charset.StandardCharsets
import javax.crypto.AEADBadTagException

class NoteCipherTest {
    private fun hex(bytes: ByteArray) = bytes.joinToString("") { "%02x".format(it) }
    private fun utf8(s: String) = s.toByteArray(StandardCharsets.UTF_8)

    @Test
    fun pbkdf2MatchesRfc7914Vectors() {
        assertEquals(
            "55ac046e56e3089fec1691c22544b605f94185216dde0465e68b9d57c20dacbc" +
                "49ca9cccf179b645991664b39d77ef317c71b845b1e30bd509112041d3a19783",
            hex(NoteCipher.pbkdf2(utf8("passwd"), utf8("salt"), 1, 64)),
        )
        assertEquals(
            "4ddcd8f60b98be21830cee5ef22701f9641a4418d04c0414aeff08876b34ab56" +
                "a1d425a1225833549adb841b51c9b3176a272bdebba1d078478f62b397f33c8d",
            hex(NoteCipher.pbkdf2(utf8("Password"), utf8("NaCl"), 80_000, 64)),
        )
    }

    @Test
    fun pbkdf2HandlesUnicodeAndEmptyPasswords() {
        assertEquals(
            "516c4cfbf60066dc5769ae6ce3c06aae67841d34869ff951588a1f3f8847d652",
            hex(NoteCipher.pbkdf2(NoteCipher.passwordBytes("pässwörd"), utf8("salt"), 2, 32)),
        )
        assertEquals(
            "5ddf839afa2d5fb4be56e1a0f48917617559bef61ec122bfca1c7f75ac8f401d",
            hex(NoteCipher.pbkdf2(ByteArray(0), utf8("salt"), 3, 32)),
        )
        // Decomposed "ä" (a + combining diaeresis) is the same password as the composed one.
        assertArrayEquals(NoteCipher.passwordBytes("päss"), NoteCipher.passwordBytes("päss"))
    }

    @Test
    fun wrapsAndUnwrapsTheDataKey() {
        val key = NoteCipher.randomBytes(NoteCipher.KEY_BYTES)
        val vault = NoteCipher.wrap(key, "correct horse", iterations = 1000)
        assertArrayEquals(key, NoteCipher.unwrap(vault, "correct horse"))
        try {
            NoteCipher.unwrap(vault, "correct horsE")
            fail("A wrong password must not unlock")
        } catch (e: NoteCipher.WrongPassword) {
            // expected
        }
        // A new password wraps the same key with a fresh salt.
        val again = NoteCipher.wrap(key, "correct horse", iterations = 1000)
        assertFalse(again.salt.contentEquals(vault.salt))
        assertArrayEquals(key, NoteCipher.unwrap(again, "correct horse"))
    }

    @Test
    fun sealedNotesOpenOnlyWithTheirKeyAndId() {
        val key = NoteCipher.randomBytes(NoteCipher.KEY_BYTES)
        val sealed = NoteCipher.seal(key, utf8("secret"), utf8("note:a"))
        assertEquals("secret", String(NoteCipher.open(key, sealed, utf8("note:a")), StandardCharsets.UTF_8))
        assertFalse(String(sealed, StandardCharsets.ISO_8859_1).contains("secret"))

        for (bad in listOf<() -> Unit>(
            { NoteCipher.open(key, sealed, utf8("note:b")) },
            { NoteCipher.open(NoteCipher.randomBytes(32), sealed, utf8("note:a")) },
            { NoteCipher.open(key, sealed.copyOf().also { it[it.size - 1] = (it[it.size - 1] + 1).toByte() }, utf8("note:a")) },
        )) {
            try {
                bad()
                fail("Tampered or misused ciphertext must not open")
            } catch (e: AEADBadTagException) {
                // expected
            }
        }
    }
}
