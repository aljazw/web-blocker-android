/**
 * Notes, and the password that protects some of them.
 *
 * Protected notes are encrypted on the device by NoteCryptoModule.kt
 * (AES-256-GCM, key wrapped with PBKDF2 of the password). JS never sees the
 * key or stores the password: it only asks the native side to unlock, and to
 * encrypt or decrypt one note at a time. A forgotten password can't be
 * recovered; the protected notes can only be deleted.
 *
 * The notes lock when the app has been in the background for a minute, or on
 * request.
 */
import { useSyncExternalStore } from 'react';
import { AppState, NativeModules } from 'react-native';
import { Note, StoredNote } from '../types/types';
import {
    deleteProtectedNotes,
    deleteStoredNote,
    getNotesVault,
    getStoredNotes,
    saveStoredNote,
    setNotesVault,
} from '../storage';
import { logger } from './logger';

interface NoteCryptoModule {
    createVault(password: string): Promise<string>;
    unlock(vault: string, password: string): Promise<boolean>;
    changePassword(vault: string, current: string, next: string): Promise<string | null>;
    encrypt(plain: string, id: string): Promise<string>;
    decrypt(sealed: string, id: string): Promise<string>;
    isUnlocked(): Promise<boolean>;
    lock(): void;
    lockAfter(ms: number): void;
    cancelLock(): void;
    setSecure(secure: boolean): void;
}

const native: NoteCryptoModule | undefined = NativeModules.NoteCrypto;

export const MIN_PASSWORD_LENGTH = 8;
/** How long the notes stay unlocked with the app in the background. */
const LOCK_DELAY_MS = 60_000;

const crypto = (): NoteCryptoModule => {
    if (!native) {
        throw new Error('Note encryption isn’t available on this device.');
    }
    return native;
};

// ---- Lock state -------------------------------------------------------------

let unlocked = false;
/** Decrypted notes by id, only while unlocked; keyed to the ciphertext so edits elsewhere never show stale text. */
const plain = new Map<string, { cipher: string; title: string; body: string }>();
const listeners = new Set<() => void>();

const setUnlocked = (value: boolean) => {
    if (!value) {
        plain.clear();
    }
    if (unlocked !== value) {
        unlocked = value;
        listeners.forEach(listener => listener());
    }
};

const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
};

/** Whether protected notes are readable right now; re-renders when that changes. */
export const useNotesUnlocked = () => useSyncExternalStore(subscribe, () => unlocked);

export const lockNotes = () => {
    native?.lock();
    setUnlocked(false);
};

/** Keeps open notes out of screenshots and the recent-apps preview. */
export const setNotesScreenSecure = (secure: boolean) => native?.setSecure(secure);

let watching = false;

/** Locks the notes a minute after the app leaves the foreground. Call once at startup. */
export const watchNotesLock = () => {
    if (watching || !native) {
        return;
    }
    watching = true;
    native.lock(); // a JS reload starts locked
    let jsLock: ReturnType<typeof setTimeout> | null = null;
    AppState.addEventListener('change', state => {
        if (state === 'background') {
            native.lockAfter(LOCK_DELAY_MS);
            // Also drop the decrypted text on this side, if JS timers still run in the background.
            jsLock = setTimeout(() => setUnlocked(false), LOCK_DELAY_MS);
        } else if (state === 'active') {
            if (jsLock) {
                clearTimeout(jsLock);
                jsLock = null;
            }
            native.cancelLock();
            native
                .isUnlocked()
                .then(setUnlocked)
                .catch(() => setUnlocked(false));
        }
    });
};

// ---- Password ---------------------------------------------------------------

export const hasNotesPassword = async (): Promise<boolean> => (await getNotesVault()) !== null;

/** Sets the first notes password and unlocks. Resolves false if it couldn't be saved. */
export const createNotesPassword = async (password: string): Promise<boolean> => {
    if (await hasNotesPassword()) {
        throw new Error('A notes password is already set.');
    }
    const vault = await crypto().createVault(password);
    if (!(await setNotesVault(vault))) {
        lockNotes();
        return false;
    }
    setUnlocked(true);
    return true;
};

/** Unlocks the protected notes. */
export const unlockNotes = async (password: string): Promise<'ok' | 'wrong'> => {
    const vault = await getNotesVault();
    if (!vault) {
        throw new Error('No notes password is set.');
    }
    const ok = await crypto().unlock(vault, password);
    setUnlocked(ok);
    return ok ? 'ok' : 'wrong';
};

/**
 * Changes the password. The notes themselves stay as they are: only the key
 * that encrypts them is re-wrapped, so nothing can be half changed.
 */
export const changeNotesPassword = async (current: string, next: string): Promise<'ok' | 'wrong' | 'failed'> => {
    const vault = await getNotesVault();
    if (!vault) {
        throw new Error('No notes password is set.');
    }
    const updated = await crypto().changePassword(vault, current, next);
    if (!updated) {
        return 'wrong';
    }
    setUnlocked(true);
    return (await setNotesVault(updated)) ? 'ok' : 'failed';
};

/** For a forgotten password: deletes every protected note and the password. */
export const resetNotesPassword = async (): Promise<boolean> => {
    lockNotes();
    return (await deleteProtectedNotes()) && (await setNotesVault(null));
};

// ---- Notes ------------------------------------------------------------------

const toNote = async (stored: StoredNote): Promise<Note> => {
    const base = { id: stored.id, createdAt: stored.createdAt, updatedAt: stored.updatedAt };
    if (!stored.cipher) {
        return { ...base, title: stored.title ?? '', body: stored.body ?? '', protected: false, locked: false };
    }
    const cached = plain.get(stored.id);
    if (cached && cached.cipher === stored.cipher) {
        return { ...base, title: cached.title, body: cached.body, protected: true, locked: false };
    }
    if (unlocked && native) {
        try {
            const v = JSON.parse(await native.decrypt(stored.cipher, stored.id));
            const text = { title: String(v.title ?? ''), body: String(v.body ?? '') };
            plain.set(stored.id, { cipher: stored.cipher, ...text });
            return { ...base, ...text, protected: true, locked: false };
        } catch (error) {
            // Locked in the meantime, or a note from another password: it stays locked.
            logger.warn('Could not open a protected note', error);
        }
    }
    return { ...base, title: '', body: '', protected: true, locked: true };
};

/** Every note, newest edit first; protected ones readable only while unlocked. */
export const loadNotes = async (): Promise<Note[]> => {
    const stored = await getStoredNotes();
    const notes = await Promise.all(stored.map(toNote));
    return notes.sort((a, b) => b.updatedAt - a.updatedAt);
};

export const loadNote = async (id: string): Promise<Note | null> => {
    const stored = (await getStoredNotes()).find(n => n.id === id);
    return stored ? toNote(stored) : null;
};

/** Saves a note, encrypting it when protected (the notes must be unlocked then). Resolves false on failure. */
export const saveNote = async (note: Note): Promise<boolean> => {
    const base = { id: note.id, createdAt: note.createdAt, updatedAt: note.updatedAt };
    if (!note.protected) {
        plain.delete(note.id);
        return saveStoredNote({ ...base, title: note.title, body: note.body });
    }
    if (!unlocked) {
        return false;
    }
    try {
        const cipher = await crypto().encrypt(JSON.stringify({ title: note.title, body: note.body }), note.id);
        plain.set(note.id, { cipher, title: note.title, body: note.body });
        return await saveStoredNote({ ...base, cipher });
    } catch (error) {
        logger.warn('Could not encrypt a note', error);
        return false;
    }
};

export const deleteNote = (id: string): Promise<boolean> => {
    plain.delete(id);
    return deleteStoredNote(id);
};

/** The note's first line, for lists when it has no title. */
export const noteTitle = (note: Note) =>
    note.locked ? 'Protected note' : note.title.trim() || note.body.trim().split('\n')[0] || 'Empty note';

/** A short preview of the text under the title. */
export const notePreview = (note: Note) => {
    if (note.locked) {
        return 'Locked';
    }
    const text = note.title.trim() ? note.body : note.body.trim().split('\n').slice(1).join(' ');
    return text.replace(/\s+/g, ' ').trim();
};
