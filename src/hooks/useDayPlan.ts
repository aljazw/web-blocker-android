import { useCallback, useMemo } from 'react';
import { DayPlan } from '../types/types';
import { STORAGE_KEYS, emptyDay, getDay, getSleepSchedule } from '../storage';
import { DEFAULT_SLEEP_SCHEDULE } from '../utils/sleep';
import { anchorsOf, dayTasks } from '../utils/dayPlan';
import { useFocusData } from './useFocusData';
import { useHabits } from './useHabits';

const DAY_KEYS = [STORAGE_KEYS.days];
const SLEEP_KEYS = [STORAGE_KEYS.sleepSchedule];

/**
 * One day of the plan: its tasks in order and the wake-up and bedtime they
 * fit between. Stays current with changes made anywhere.
 */
export const useDayPlan = (dateKey: string) => {
    const { habits, loaded: habitsLoaded } = useHabits();
    const load = useCallback(() => getDay(dateKey), [dateKey]);
    const empty = useMemo<DayPlan>(() => emptyDay(dateKey), [dateKey]);
    const { data, loaded } = useFocusData(load, empty, { watch: DAY_KEYS });
    const { data: sleep } = useFocusData(getSleepSchedule, DEFAULT_SLEEP_SCHEDULE, { watch: SLEEP_KEYS });

    // Right after switching days the previous day is still in state; never show it.
    const current = data.date === dateKey;
    const day = current ? data : empty;
    const tasks = useMemo(() => dayTasks(day, habits), [day, habits]);
    const anchors = useMemo(() => anchorsOf(sleep), [sleep]);

    return { day, tasks, habits, anchors, loaded: loaded && current && habitsLoaded };
};
