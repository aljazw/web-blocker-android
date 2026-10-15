import { useCallback, useMemo } from 'react';
import { DayPlan } from '../types/types';
import { DEFAULT_DAY_HOURS, STORAGE_KEYS, emptyDay, getDay, getDayHours } from '../storage';
import { anchorsOf, dayTasks } from '../utils/dayPlan';
import { useFocusData } from './useFocusData';
import { useHabits } from './useHabits';

const DAY_KEYS = [STORAGE_KEYS.days];
const HOURS_KEYS = [STORAGE_KEYS.dayHours, STORAGE_KEYS.sleepSchedule];

/**
 * One day of the plan: its tasks in order and the wake-up and bedtime they
 * fit between. Stays current with changes made anywhere.
 */
export const useDayPlan = (dateKey: string) => {
    const { habits, loaded: habitsLoaded } = useHabits();
    const load = useCallback(() => getDay(dateKey), [dateKey]);
    const empty = useMemo<DayPlan>(() => emptyDay(dateKey), [dateKey]);
    const { data, loaded } = useFocusData(load, empty, { watch: DAY_KEYS });
    const { data: hours } = useFocusData(getDayHours, DEFAULT_DAY_HOURS, { watch: HOURS_KEYS });

    // Right after switching days the previous day is still in state; never show it.
    const current = data.date === dateKey;
    const day = current ? data : empty;
    const tasks = useMemo(() => dayTasks(day, habits), [day, habits]);
    const anchors = useMemo(() => anchorsOf(hours), [hours]);

    return { day, tasks, habits, anchors, loaded: loaded && current && habitsLoaded };
};
