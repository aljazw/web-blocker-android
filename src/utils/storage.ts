import { NativeModules } from 'react-native';
import { BlockedAppData, BlockedWebsitesData, Habit } from '../types/types';

const { SharedStorage } = NativeModules;

/**
 * Keys shared with the native side (BlockAccessibilityService, DnsVpnService,
 * SiteLockScreen read the same "BlockedPrefs" SharedPreferences).
 */
const KEYS = {
    websites: '@blocked_websites',
    apps: '@blocked_apps',
    habits: '@habits',
    hasSeenWelcome: '@has_seen_welcome',
    notificationScheduled: '@notification_scheduled',
    darkMode: '@is_dark_mode',
    passphrase: '@is_passphrase',
    accent: '@accent_color',
} as const;

// ---- Low-level helpers ------------------------------------------------------

/**
 * Every read-modify-write runs one after another through this queue, so two
 * quick actions (e.g. adding two sites, or a double tap) can never read the
 * same old list and overwrite each other's change.
 */
let queue: Promise<unknown> = Promise.resolve();
const serialized = <T>(task: () => Promise<T>): Promise<T> => {
    const run = queue.then(task, task);
    queue = run.catch(() => undefined);
    return run;
};

/** Parses stored JSON; damaged data is treated as missing instead of crashing the app. */
const parseJson = (raw: string | null | undefined): unknown => {
    if (!raw) return null;
    try {
        return JSON.parse(raw);
    } catch {
        return null;
    }
};

const readBool = async (key: string): Promise<boolean | null> => {
    const value = await SharedStorage.getItem(key);
    if (value === 'true') return true;
    if (value === 'false') return false;
    return null;
};

const writeJson = async (key: string, value: unknown): Promise<boolean> =>
    (await SharedStorage.setItem(key, JSON.stringify(value))) === true;

const isString = (v: unknown): v is string => typeof v === 'string' && v.length > 0;

/** Keeps only well-formed entries; fills in `visible` for old data that lacked it. */
const toWebsite = (v: any): BlockedWebsitesData | null =>
    v && isString(v.websiteUrl) && typeof v.days === 'string' && typeof v.time === 'string'
        ? { websiteUrl: v.websiteUrl, days: v.days, time: v.time, visible: v.visible !== false }
        : null;

const toApp = (v: any): BlockedAppData | null =>
    v && isString(v.packageName) && typeof v.days === 'string' && typeof v.time === 'string'
        ? {
              packageName: v.packageName,
              appName: isString(v.appName) ? v.appName : v.packageName,
              days: v.days,
              time: v.time,
              visible: v.visible !== false,
          }
        : null;

const readList = async <T>(key: string, toItem: (v: any) => T | null): Promise<T[]> => {
    const parsed = parseJson(await SharedStorage.getItem(key));
    if (!Array.isArray(parsed)) return [];
    return parsed.map(toItem).filter((item): item is T => item !== null);
};

/** Read the list, apply `change`, write it back — all inside the queue. */
const updateList = <T>(key: string, toItem: (v: any) => T | null, change: (list: T[]) => T[]) =>
    serialized(async () => {
        try {
            const list = await readList(key, toItem);
            return await writeJson(key, change(list));
        } catch {
            return false;
        }
    });

// ---- Blocked websites -------------------------------------------------------

export const getBlockedWebsites = async (): Promise<BlockedWebsitesData[]> => {
    try {
        return await readList(KEYS.websites, toWebsite);
    } catch {
        throw new Error('Failed to get blocked websites');
    }
};

export const isWebsiteBlocked = async (url: string): Promise<boolean> => {
    try {
        return (await getBlockedWebsites()).some(site => site.websiteUrl === url);
    } catch {
        return false;
    }
};

/** Adds a site. Adding one that's already on the list is a no-op that still succeeds. */
export const addBlockedWebsite = (entry: BlockedWebsitesData): Promise<boolean> =>
    updateList(KEYS.websites, toWebsite, list =>
        list.some(site => site.websiteUrl === entry.websiteUrl) ? list : [...list, entry],
    );

export const deleteBlockedWebsite = (url: string): Promise<boolean> =>
    updateList(KEYS.websites, toWebsite, list => list.filter(site => site.websiteUrl !== url));

export const hideBlockedWebsite = (url: string): Promise<boolean> =>
    updateList(KEYS.websites, toWebsite, list =>
        list.map(site => (site.websiteUrl === url ? { ...site, visible: false } : site)),
    );

// ---- Blocked apps -----------------------------------------------------------

export const getBlockedApps = async (): Promise<BlockedAppData[]> => {
    try {
        return await readList(KEYS.apps, toApp);
    } catch {
        throw new Error('Failed to get blocked apps');
    }
};

export const isAppBlocked = async (packageName: string): Promise<boolean> => {
    try {
        return (await getBlockedApps()).some(app => app.packageName === packageName);
    } catch {
        return false;
    }
};

/** Adds an app. Adding one that's already on the list is a no-op that still succeeds. */
export const addBlockedApp = (entry: BlockedAppData): Promise<boolean> =>
    updateList(KEYS.apps, toApp, list =>
        list.some(app => app.packageName === entry.packageName) ? list : [...list, entry],
    );

export const deleteBlockedApp = (packageName: string): Promise<boolean> =>
    updateList(KEYS.apps, toApp, list => list.filter(app => app.packageName !== packageName));

export const hideBlockedApp = (packageName: string): Promise<boolean> =>
    updateList(KEYS.apps, toApp, list =>
        list.map(app => (app.packageName === packageName ? { ...app, visible: false } : app)),
    );

// ---- Habits -----------------------------------------------------------------

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^\d{2}:\d{2}$/;

const toHabit = (v: any): Habit | null => {
    if (!v || !isString(v.id) || !isString(v.title) || !Array.isArray(v.days) || v.days.length !== 7) {
        return null;
    }
    return {
        id: v.id,
        title: v.title,
        emoji: isString(v.emoji) ? v.emoji : '✅',
        days: v.days.map((d: unknown) => d === true),
        reminder: typeof v.reminder === 'string' && TIME.test(v.reminder) ? v.reminder : null,
        createdAt: typeof v.createdAt === 'string' && DATE_KEY.test(v.createdAt) ? v.createdAt : '1970-01-01',
        completions: Array.isArray(v.completions)
            ? [
                  ...new Set<string>(v.completions.filter((k: unknown) => typeof k === 'string' && DATE_KEY.test(k))),
              ].sort()
            : [],
    };
};

export const getHabits = async (): Promise<Habit[]> => {
    try {
        return await readList(KEYS.habits, toHabit);
    } catch {
        throw new Error('Failed to get habits');
    }
};

/** Inserts the habit, or replaces the one with the same id. */
export const saveHabit = (habit: Habit): Promise<boolean> =>
    updateList(KEYS.habits, toHabit, list =>
        list.some(h => h.id === habit.id) ? list.map(h => (h.id === habit.id ? habit : h)) : [...list, habit],
    );

/** Applies `change` to the stored habit (by id) inside the write queue, so check-ins never race. */
export const updateHabit = (id: string, change: (habit: Habit) => Habit): Promise<boolean> =>
    updateList(KEYS.habits, toHabit, list => list.map(h => (h.id === id ? change(h) : h)));

export const deleteHabit = (id: string): Promise<boolean> =>
    updateList(KEYS.habits, toHabit, list => list.filter(h => h.id !== id));

// ---- Preferences ------------------------------------------------------------

export const hasUserSeenWelcome = async (): Promise<boolean> => (await readBool(KEYS.hasSeenWelcome)) === true;

export const setUserHasSeenWelcome = async (hasSeenWelcome: boolean): Promise<void> => {
    await writeJson(KEYS.hasSeenWelcome, hasSeenWelcome);
};

export const isNotificationScheduled = async (): Promise<boolean> =>
    (await readBool(KEYS.notificationScheduled)) === true;

export const setNotificationScheduled = async (isScheduled: boolean): Promise<void> => {
    await writeJson(KEYS.notificationScheduled, isScheduled);
};

export const getThemePreference = (): Promise<boolean | null> => readBool(KEYS.darkMode);

export const setThemePreference = async (isDarkMode: boolean): Promise<void> => {
    await writeJson(KEYS.darkMode, isDarkMode);
};

export const getPassphrasePreference = (): Promise<boolean | null> => readBool(KEYS.passphrase);

export const setPassphrasePreference = async (isPassphrase: boolean): Promise<void> => {
    await writeJson(KEYS.passphrase, isPassphrase);
};

export const getAccentPreference = async (): Promise<string | null> => {
    const value = parseJson(await SharedStorage.getItem(KEYS.accent));
    return typeof value === 'string' ? value : null;
};

export const setAccentPreference = async (accent: string): Promise<void> => {
    await writeJson(KEYS.accent, accent);
};
