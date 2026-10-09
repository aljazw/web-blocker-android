import { useCallback, useRef } from 'react';
import { Habit } from '../types/types';
import { STORAGE_KEYS, deleteHabit, getHabits, saveHabit, updateHabit } from '../storage';
import { toggleCompletion } from '../utils/habits';
import { cancelHabitReminders, dismissTodaysReminder, syncHabitReminders } from '../utils/habitReminders';
import { useFocusData } from './useFocusData';

export type ToggleResult =
    | { status: 'saved'; habit: Habit }
    /** A save for this habit was already running; the tap was ignored. */
    | { status: 'busy' }
    /** Saving failed; the screen was rolled back. */
    | { status: 'failed' };

const NONE: Habit[] = [];
const WATCH = [STORAGE_KEYS.habits];

/** All habits; stays current with changes made anywhere (other screens, pop-ups, finished sessions). */
export const useHabits = () => {
    const {
        data: habits,
        setData: setHabits,
        loaded,
        failed: loadFailed,
        reload,
    } = useFocusData(getHabits, NONE, { watch: WATCH });
    /** Habits with a check-in save in flight; extra taps on them are ignored. */
    const pending = useRef(new Set<string>());

    /**
     * Checks today's box (or unchecks it). Updates the screen immediately and
     * rolls back if saving fails.
     */
    const toggleToday = useCallback(
        async (habit: Habit): Promise<ToggleResult> => {
            if (pending.current.has(habit.id)) {
                return { status: 'busy' };
            }
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
        },
        [setHabits],
    );

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
