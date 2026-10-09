import { KEYS, parseJson, readBool, readParsed, writeJson } from './core';

const flag = (key: string) => ({
    get: async (): Promise<boolean> => (await readBool(key)) === true,
    set: async (value: boolean): Promise<void> => {
        await writeJson(key, value);
    },
});

const welcome = flag(KEYS.hasSeenWelcome);
const notificationScheduled = flag(KEYS.notificationScheduled);

export const hasUserSeenWelcome = welcome.get;
export const setUserHasSeenWelcome = welcome.set;
export const isNotificationScheduled = notificationScheduled.get;
export const setNotificationScheduled = notificationScheduled.set;

/** null = never chosen (follow the default). */
export const getThemePreference = (): Promise<boolean | null> => readBool(KEYS.darkMode);
export const setThemePreference = flag(KEYS.darkMode).set;

export const getPassphrasePreference = (): Promise<boolean | null> => readBool(KEYS.passphrase);
export const setPassphrasePreference = flag(KEYS.passphrase).set;

const toAccent = (raw: string | null): string | null => {
    const value = parseJson(raw);
    return typeof value === 'string' ? value : null;
};

export const getAccentPreference = (): Promise<string | null> => readParsed(KEYS.accent, toAccent);

export const setAccentPreference = async (accent: string): Promise<void> => {
    await writeJson(KEYS.accent, accent);
};
