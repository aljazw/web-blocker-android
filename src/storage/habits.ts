import { Habit } from '../types/types';
import { habitIconFrom } from '../constants/habitIcons';
import { DATE_KEY, KEYS, TIME, isString, readList, updateList, upsertById, withoutId } from './core';

const toHabit = (v: any): Habit | null => {
    if (!v || !isString(v.id) || !isString(v.title) || !Array.isArray(v.days) || v.days.length !== 7) {
        return null;
    }
    return {
        id: v.id,
        title: v.title,
        icon: habitIconFrom(v.icon, v.emoji),
        days: v.days.map((d: unknown) => d === true),
        reminder: typeof v.reminder === 'string' && TIME.test(v.reminder) ? v.reminder : null,
        createdAt: typeof v.createdAt === 'string' && DATE_KEY.test(v.createdAt) ? v.createdAt : '1970-01-01',
        completions: Array.isArray(v.completions)
            ? [
                  ...new Set<string>(v.completions.filter((k: unknown) => typeof k === 'string' && DATE_KEY.test(k))),
              ].sort()
            : [],
        ...(v.link === 'apnea' || v.link === 'workout' ? { link: v.link } : {}),
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
    updateList(KEYS.habits, toHabit, list => upsertById(list, habit));

/** Applies `change` to the stored habit (by id) inside the write queue, so check-ins never race. */
export const updateHabit = (id: string, change: (habit: Habit) => Habit): Promise<boolean> =>
    updateList(KEYS.habits, toHabit, list => list.map(h => (h.id === id ? change(h) : h)));

export const deleteHabit = (id: string): Promise<boolean> =>
    updateList(KEYS.habits, toHabit, list => withoutId(list, id));
