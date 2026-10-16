import { StoredNote } from '../types/types';
import {
    KEYS,
    isNumber,
    isString,
    parseJson,
    readList,
    readParsed,
    updateList,
    upsertById,
    withoutId,
    writeJson,
} from './core';

const toNote = (v: any): StoredNote | null => {
    if (!v || !isString(v.id) || !isNumber(v.createdAt) || !isNumber(v.updatedAt)) {
        return null;
    }
    if (isString(v.cipher)) {
        return { id: v.id, createdAt: v.createdAt, updatedAt: v.updatedAt, cipher: v.cipher };
    }
    return {
        id: v.id,
        createdAt: v.createdAt,
        updatedAt: v.updatedAt,
        title: typeof v.title === 'string' ? v.title : '',
        body: typeof v.body === 'string' ? v.body : '',
    };
};

/** All notes, protected ones still encrypted. */
export const getStoredNotes = (): Promise<StoredNote[]> => readList(KEYS.notes, toNote);

/** Inserts or replaces a note. Resolves false on failure. */
export const saveStoredNote = (note: StoredNote): Promise<boolean> =>
    updateList(KEYS.notes, toNote, list => upsertById(list, note));

export const deleteStoredNote = (id: string): Promise<boolean> =>
    updateList(KEYS.notes, toNote, list => withoutId(list, id));

/** Removes every protected note, for a forgotten password. */
export const deleteProtectedNotes = (): Promise<boolean> =>
    updateList(KEYS.notes, toNote, list => list.filter(n => !n.cipher));

const toVault = (raw: string | null): string | null => {
    const v = parseJson(raw) as any;
    return v && typeof v === 'object' && isString(v.salt) && isString(v.key) ? JSON.stringify(v) : null;
};

/** The vault JSON for NoteCryptoModule, or null before a notes password is set. */
export const getNotesVault = (): Promise<string | null> => readParsed(KEYS.notesVault, toVault);

/** Saves the vault, or removes it with null. Resolves false on failure. */
export const setNotesVault = async (vault: string | null): Promise<boolean> => {
    try {
        return await writeJson(KEYS.notesVault, vault ? JSON.parse(vault) : null);
    } catch {
        return false;
    }
};
