import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { Habit } from '../types/types';
import { deleteHabit, getHabits, saveHabit, updateHabit } from '../utils/storage';
import { toggleCompletion } from '../utils/habits';
import { cancelHabitReminders, dismissTodaysReminder, syncHabitReminders } from '../utils/habitReminders';

export type ToggleResult =
    | { status: 'saved'; habit: Habit }
    /** A save for this habit was already running; the tap was ignored. */
    | { status: 'busy' }
    /** Saving failed; the screen was rolled back. */
    | { status: 'failed' };

/** All habits, reloaded whenever the screen gains focus. */
export const useHabits = () => {
    const [habits, setHabits] = useState<Habit[]>([]);
    const [loaded, setLoaded] = useState(false);
    const [loadFailed, setLoadFailed] = useState(false);
    /** Habits with a check-in save in flight; extra taps on them are ignored. */
    const pending = useRef(new Set<string>());

    const reload = useCallback(async () => {
        try {
            setHabits(await getHabits());
            setLoadFailed(false);
        } catch {
            setLoadFailed(true);
        } finally {
            setLoaded(true);
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
            reload();
        }, [reload]),
    );

    /**
     * Checks today's box (or unchecks it). Updates the screen immediately and
     * rolls back if saving fails.
     */
    const toggleToday = useCallback(async (habit: Habit): Promise<ToggleResult> => {
        if (pending.current.has(habit.id)) return { status: 'busy' };
        pending.current.add(habit.id);

        const updated = toggleCompletion(habit);
        setHabits(prev => prev.map(h => (h.id === habit.id ? updated : h)));

        // Write exactly the state the user now sees, so screen and storage can't disagree.
        const ok = await updateHabit(habit.id, stored => ({ ...stored, completions: updated.completions })).finally(
            () => pending.current.delete(habit.id),
        );
        if (!ok) {
            setHabits(prev => prev.map(h => (h.id === habit.id ? habit : h)));
            return { status: 'failed' };
        }
        if (updated.completions.length > habit.completions.length) {
            dismissTodaysReminder(updated);
        }
        return { status: 'saved', habit: updated };
    }, []);

    return { habits, loaded, loadFailed, reload, toggleToday };
};

/** Saves a habit and (re)schedules its reminders. */
export const persistHabit = async (habit: Habit): Promise<boolean> => {
    const ok = await saveHabit(habit);
    if (ok) {
        await syncHabitReminders(habit);
    }
    return ok;
};

/** Deletes a habit and its reminders. */
export const removeHabit = async (habitId: string): Promise<boolean> => {
    const ok = await deleteHabit(habitId);
    if (ok) {
        await cancelHabitReminders(habitId);
    }
    return ok;
};
