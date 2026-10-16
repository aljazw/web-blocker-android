/** Backup export / import: round trip, and an import can never weaken protection. */
jest.mock('react-native', () => {
    const store = new Map<string, string>();
    return {
        NativeModules: {
            SharedStorage: {
                store,
                getItem: jest.fn(async (key: string) => store.get(key) ?? null),
                setItem: jest.fn(async (key: string, value: string) => {
                    store.set(key, value);
                    return true;
                }),
            },
        },
    };
});
jest.mock('../src/components/Icon', () => ({ isIconName: (v: unknown) => typeof v === 'string' }));

import { clearStorageCache } from '../src/storage/core';
import {
    createBackup,
    getBlockedWebsites,
    getHabits,
    getSleepSchedule,
    getVacation,
    importBackup,
    parseBackup,
} from '../src/storage';

const { SharedStorage } = jest.requireMock('react-native').NativeModules;
const store: Map<string, string> = SharedStorage.store;

const site = (url: string, visible = true) => ({ websiteUrl: url, days: 'Full Week', time: 'All Day Long', visible });
const habit = (id: string) => ({
    id,
    title: id,
    icon: 'Target',
    days: [true, true, true, true, true, true, true],
    duration: 15,
    createdAt: '2026-10-01',
    completions: ['2026-10-02'],
});
const NOW = new Date(2026, 9, 13, 12);

beforeEach(() => {
    store.clear();
    clearStorageCache();
});

test('exports everything and imports it back on a fresh phone', async () => {
    store.set('@blocked_websites', JSON.stringify([site('youtube.com')]));
    store.set('@habits', JSON.stringify([habit('read')]));
    store.set('@apnea_tables', JSON.stringify([{ id: 't1', name: 'CO2' }]));
    store.set('@dns_upstream', 'dns.adguard-dns.com');
    store.set('@is_dark_mode', 'true');

    const backup = await createBackup(NOW);
    const text = JSON.stringify(backup);

    store.clear();
    clearStorageCache();
    const parsed = parseBackup(text);
    if ('error' in parsed) {
        throw new Error(parsed.error);
    }
    const result = await importBackup(parsed.backup, NOW);

    expect(result.ok).toBe(true);
    expect((await getBlockedWebsites()).map(s => s.websiteUrl)).toEqual(['youtube.com']);
    expect((await getHabits()).map(h => h.completions)).toEqual([['2026-10-02']]);
    expect(JSON.parse(store.get('@apnea_tables')!)).toEqual([{ id: 't1', name: 'CO2' }]);
    expect(store.get('@dns_upstream')).toBe('dns.adguard-dns.com');
    expect(store.get('@is_dark_mode')).toBe('true');
});

test('import only adds blocks, never removes or un-hides them', async () => {
    store.set('@blocked_websites', JSON.stringify([site('reddit.com', false)]));
    await importBackup(
        {
            format: 'discipline-app-backup',
            version: 1,
            exportedAt: NOW.toISOString(),
            data: { websites: [site('reddit.com', true), site('x.com'), { junk: 1 }] },
        },
        NOW,
    );
    const sites = await getBlockedWebsites();
    expect(sites.map(s => [s.websiteUrl, s.visible])).toEqual([
        ['reddit.com', false],
        ['x.com', true],
    ]);
});

test('import cannot turn sleep time off or start a vacation now', async () => {
    store.set('@sleep_schedule', JSON.stringify({ enabled: true, bedtime: '23:00', wake: '07:00' }));
    const result = await importBackup(
        {
            format: 'discipline-app-backup',
            version: 1,
            exportedAt: NOW.toISOString(),
            data: {
                sleepSchedule: { enabled: false, bedtime: '01:00', wake: '05:00' },
                vacation: { start: '2026-10-10', end: '2026-10-20' },
            },
        },
        NOW,
    );
    expect(await getSleepSchedule()).toEqual({ enabled: true, bedtime: '23:00', wake: '07:00' });
    expect(await getVacation()).toBeNull();
    expect(result.skipped).toHaveLength(2);
});

test('rejects files that are not backups of this app', () => {
    expect(parseBackup('not json')).toHaveProperty('error');
    expect(parseBackup('{"format":"other","data":{}}')).toHaveProperty('error');
    expect(parseBackup('{"format":"discipline-app-backup","version":99,"data":{}}')).toHaveProperty('error');
    expect(parseBackup('{"format":"gaman-backup","version":1,"data":{}}')).toHaveProperty('backup');
});

test('notes travel with their encrypted key, and passphrase protection can only be turned on', async () => {
    const vault = { v: 1, kdf: 'pbkdf2-sha256', iter: 310000, salt: 'c2FsdA==', key: 'a2V5' };
    const notes = [
        { id: 'n1', createdAt: 1, updatedAt: 2, title: 'Groceries', body: 'milk' },
        { id: 'n2', createdAt: 1, updatedAt: 3, cipher: 'ZW5jcnlwdGVk' },
    ];
    store.set('@notes', JSON.stringify(notes));
    store.set('@notes_vault', JSON.stringify(vault));
    store.set('@music_folder', JSON.stringify('Music/Gym'));
    store.set('@is_passphrase', 'true');

    const text = JSON.stringify(await createBackup(NOW));
    expect(text).not.toContain('password');

    store.clear();
    clearStorageCache();
    const parsed = parseBackup(text);
    if ('error' in parsed) {
        throw new Error(parsed.error);
    }
    expect((await importBackup(parsed.backup, NOW)).ok).toBe(true);
    expect(JSON.parse(store.get('@notes')!)).toEqual(notes);
    expect(JSON.parse(store.get('@notes_vault')!)).toEqual(vault);
    expect(JSON.parse(store.get('@music_folder')!)).toBe('Music/Gym');
    expect(store.get('@is_passphrase')).toBe('true');

    // A backup with it off leaves it on.
    await importBackup({ ...parsed.backup, data: { ...parsed.backup.data, passphrase: false } }, NOW);
    expect(store.get('@is_passphrase')).toBe('true');
});
