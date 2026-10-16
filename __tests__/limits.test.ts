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

import { getBlockedApps } from '../src/storage';
import { clearStorageCache } from '../src/storage/core';
import { describeSchedule } from '../src/utils/schedule';
import { parseLimitUsage, usageKeyOf } from '../src/utils/limitUsage';

const today = new Date('2026-10-16T12:00:00');

describe('describeSchedule with a daily limit', () => {
    it('leads with the limit and leaves out "every day"', () => {
        expect(describeSchedule('Full Week', 'All Day Long', 30)).toBe('30 min a day');
        expect(describeSchedule('Mon, Tue, Wed, Thu, Fri', 'All Day Long', 90)).toBe('1 h 30 min a day · Weekdays');
    });

    it('keeps the old wording without a limit', () => {
        expect(describeSchedule('Full Week', 'All Day Long')).toBe('Always');
    });
});

describe('limit usage', () => {
    it('keys apps and sites like the native side', () => {
        expect(usageKeyOf({ kind: 'app', key: 'com.instagram.android' })).toBe('app:com.instagram.android');
        expect(usageKeyOf({ kind: 'site', key: 'youtube.com' })).toBe('site:youtube.com');
    });

    it('reads whole minutes used today', () => {
        const raw = JSON.stringify({ day: '2026-10-16', used: { 'site:youtube.com': 754_000, 'app:x': -5 } });
        expect(parseLimitUsage(raw, today)).toEqual({ 'site:youtube.com': 12 });
    });

    it('ignores another day and damaged data', () => {
        expect(parseLimitUsage(JSON.stringify({ day: '2026-10-15', used: { a: 600_000 } }), today)).toEqual({});
        expect(parseLimitUsage('{not json', today)).toEqual({});
        expect(parseLimitUsage(null, today)).toEqual({});
    });
});

describe('stored limits', () => {
    const { store } = jest.requireMock('react-native').NativeModules.SharedStorage;

    beforeEach(() => {
        store.clear();
        clearStorageCache();
    });

    it('keeps a valid limit and drops a damaged one (blocked outright)', async () => {
        const app = { days: 'Full Week', time: 'All Day Long', appName: 'X', visible: true };
        store.set(
            '@blocked_apps',
            JSON.stringify([
                { ...app, packageName: 'a', limit: 30 },
                { ...app, packageName: 'b', limit: 0 },
                { ...app, packageName: 'c', limit: '30' },
                { ...app, packageName: 'd' },
            ]),
        );
        const apps = await getBlockedApps();
        expect(apps.map(a => a.limit)).toEqual([30, undefined, undefined, undefined]);
    });
});
