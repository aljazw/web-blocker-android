/** Notes: protected ones are stored only encrypted and readable only while unlocked. */
jest.mock('react-native', () => {
    const store = new Map<string, string>();
    // Stand-in for NoteCryptoModule.kt: same contract, toy cipher. The real crypto is tested in NoteCipherTest.kt.
    let key: string | null = null;
    const wrap = (password: string) => JSON.stringify({ v: 1, kdf: 'pbkdf2-sha256', salt: 's', key: `k:${password}` });
    const NoteCrypto = {
        createVault: jest.fn(async (password: string) => {
            key = 'K';
            return wrap(password);
        }),
        unlock: jest.fn(async (vault: string, password: string) => {
            const ok = JSON.parse(vault).key === `k:${password}`;
            if (ok) {
                key = 'K';
            }
            return ok;
        }),
        changePassword: jest.fn(async (vault: string, current: string, next: string) => {
            if (JSON.parse(vault).key !== `k:${current}`) {
                return null;
            }
            key = 'K';
            return wrap(next);
        }),
        encrypt: jest.fn(async (plain: string, id: string) => {
            if (!key) {
                throw new Error('LOCKED');
            }
            return Buffer.from(`${id}|${plain}`).toString('base64');
        }),
        decrypt: jest.fn(async (sealed: string, id: string) => {
            if (!key) {
                throw new Error('LOCKED');
            }
            const text = Buffer.from(sealed, 'base64').toString();
            if (!text.startsWith(`${id}|`)) {
                throw new Error('bad tag');
            }
            return text.slice(id.length + 1);
        }),
        isUnlocked: jest.fn(async () => key !== null),
        lock: jest.fn(() => {
            key = null;
        }),
        lockAfter: jest.fn(),
        cancelLock: jest.fn(),
        setSecure: jest.fn(),
    };
    return {
        AppState: { addEventListener: jest.fn() },
        NativeModules: {
            NoteCrypto,
            SharedStorage: {
                store,
                getItem: jest.fn(async (k: string) => store.get(k) ?? null),
                setItem: jest.fn(async (k: string, value: string) => {
                    store.set(k, value);
                    return true;
                }),
            },
        },
    };
});
jest.mock('../src/components/Icon', () => ({ isIconName: (v: unknown) => typeof v === 'string' }));
jest.mock('../src/utils/logger', () => ({ logger: { warn: jest.fn(), error: jest.fn(), info: jest.fn() } }));

import { clearStorageCache } from '../src/storage/core';
import {
    changeNotesPassword,
    createNotesPassword,
    hasNotesPassword,
    loadNotes,
    lockNotes,
    notePreview,
    noteTitle,
    resetNotesPassword,
    saveNote,
    unlockNotes,
} from '../src/utils/notes';
import { Note } from '../src/types/types';

const { SharedStorage } = jest.requireMock('react-native').NativeModules;
const store: Map<string, string> = SharedStorage.store;

const note = (id: string, title: string, body: string, isProtected = false, updatedAt = 1): Note => ({
    id,
    createdAt: 1,
    updatedAt,
    title,
    body,
    protected: isProtected,
    locked: false,
});

beforeEach(() => {
    store.clear();
    clearStorageCache();
    lockNotes();
});

test('a protected note is stored only encrypted and opens only while unlocked', async () => {
    expect(await hasNotesPassword()).toBe(false);
    expect(await createNotesPassword('long password')).toBe(true);
    expect(await saveNote(note('a', 'Diary', 'secret thoughts', true, 2))).toBe(true);
    expect(await saveNote(note('b', 'Groceries', 'milk', false, 1))).toBe(true);

    const raw = store.get('@notes')!;
    expect(raw).not.toContain('secret thoughts');
    expect(raw).not.toContain('Diary');
    expect(store.get('@notes_vault')).not.toContain('"long password"');

    expect((await loadNotes()).map(n => [n.title, n.locked])).toEqual([
        ['Diary', false],
        ['Groceries', false],
    ]);

    lockNotes();
    const locked = await loadNotes();
    expect(locked.map(n => [n.title, n.body, n.locked])).toEqual([
        ['', '', true],
        ['Groceries', 'milk', false],
    ]);
    expect(noteTitle(locked[0])).toBe('Protected note');
    expect(notePreview(locked[0])).toBe('Locked');
    // Nothing can be written to a protected note while locked.
    expect(await saveNote(note('a', 'x', 'y', true))).toBe(false);

    expect(await unlockNotes('wrong password')).toBe('wrong');
    expect(await unlockNotes('long password')).toBe('ok');
    expect((await loadNotes())[0].body).toBe('secret thoughts');
});

test('changing the password keeps the notes; forgetting it deletes only protected ones', async () => {
    await createNotesPassword('first password');
    await saveNote(note('a', 'Diary', 'secret', true));
    await saveNote(note('b', 'Plain', 'text'));

    expect(await changeNotesPassword('not it', 'second password')).toBe('wrong');
    expect(await changeNotesPassword('first password', 'second password')).toBe('ok');
    lockNotes();
    expect(await unlockNotes('first password')).toBe('wrong');
    expect(await unlockNotes('second password')).toBe('ok');
    expect((await loadNotes()).find(n => n.id === 'a')?.body).toBe('secret');

    expect(await resetNotesPassword()).toBe(true);
    expect(await hasNotesPassword()).toBe(false);
    expect((await loadNotes()).map(n => n.id)).toEqual(['b']);
});

test('titles and previews fall back to the text', () => {
    expect(noteTitle(note('a', '', 'First line\nSecond line'))).toBe('First line');
    expect(notePreview(note('a', '', 'First line\nSecond  line'))).toBe('Second line');
    expect(noteTitle(note('a', '', '  '))).toBe('Empty note');
});
