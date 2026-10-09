/** The storage cache: fewer bridge calls, same objects while unchanged, and never stale after writes. */
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

import { Habit } from '../src/types/types';
import { clearStorageCache, onStorageChange } from '../src/storage/core';
import { getHabits, getSleepDismissedUntil, saveHabit, updateHabit } from '../src/storage';

const { SharedStorage } = jest.requireMock('react-native').NativeModules;
const mockStore: Map<string, string> = SharedStorage.store;
const mockGetItem: jest.Mock = SharedStorage.getItem;
const mockSetItem: jest.Mock = SharedStorage.setItem;

const habit = (id: string): Habit => ({
    id,
    title: id,
    icon: 'Target',
    days: [true, true, true, true, true, true, true],
    reminder: null,
    createdAt: '2026-10-01',
    completions: [],
});

beforeEach(() => {
    mockStore.clear();
    clearStorageCache();
    mockGetItem.mockClear();
    mockSetItem.mockClear();
});

it('reads a key over the bridge once, then serves it from memory', async () => {
    mockStore.set('@habits', JSON.stringify([habit('a')]));
    const first = await getHabits();
    const second = await getHabits();
    expect(mockGetItem).toHaveBeenCalledTimes(1);
    // The same array while nothing changed, so screens can skip re-rendering.
    expect(second).toBe(first);
});

it('serves writes from memory and notifies listeners', async () => {
    const changed: string[] = [];
    const unsubscribe = onStorageChange(key => changed.push(key));
    await saveHabit(habit('a'));
    await updateHabit('a', h => ({ ...h, completions: ['2026-10-09'] }));
    unsubscribe();

    const habits = await getHabits();
    expect(habits[0].completions).toEqual(['2026-10-09']);
    expect(changed).toEqual(['@habits', '@habits']);
    expect(mockGetItem).toHaveBeenCalledTimes(1); // the first read inside saveHabit
});

it('always reads keys the native side writes', async () => {
    mockStore.set('@sleep_dismissed_until', '100');
    expect(await getSleepDismissedUntil()).toBe(100);
    mockStore.set('@sleep_dismissed_until', '200');
    expect(await getSleepDismissedUntil()).toBe(200);
});

it('treats damaged data as empty', async () => {
    mockStore.set('@habits', '{not json');
    expect(await getHabits()).toEqual([]);
});
