import { Habit } from '../types/types';
import { STORAGE_KEYS, deleteHabit, getHabits, saveHabit } from '../storage';
import { useFocusData } from './useFocusData';

const NONE: Habit[] = [];
const WATCH = [STORAGE_KEYS.habits];

/** The routine (all habits, in order); stays current with changes made anywhere. */
export const useHabits = () => {
    const {
        data: habits,
        setData: setHabits,
        loaded,
        failed: loadFailed,
        reload,
    } = useFocusData(getHabits, NONE, {
        watch: WATCH,
    });
    return { habits, setHabits, loaded, loadFailed, reload };
};

/** Saves a routine task (new or changed). */
export const persistHabit = (habit: Habit): Promise<boolean> => saveHabit(habit);

/** Deletes a routine task and its history. */
export const removeHabit = (habitId: string): Promise<boolean> => deleteHabit(habitId);
