import { useCallback } from 'react';
import { Workout, WorkoutCues, WorkoutRecord, WorkoutSession } from '../types/types';
import {
    STORAGE_KEYS,
    getWorkoutCues,
    getWorkoutRecords,
    getWorkouts,
    getWorkoutSession,
    setWorkoutCues,
} from '../storage';
import { useFocusData } from './useFocusData';

const load = () => Promise.all([getWorkouts(), getWorkoutRecords(), getWorkoutSession(), getWorkoutCues()]);
const EMPTY: [Workout[], WorkoutRecord[], WorkoutSession | null, WorkoutCues] = [
    [],
    [],
    null,
    { sound: true, vibration: true },
];
const WATCH = [
    STORAGE_KEYS.workouts,
    STORAGE_KEYS.workoutRecords,
    STORAGE_KEYS.workoutSession,
    STORAGE_KEYS.workoutCues,
];

/** Workouts, history, the session in progress and cue settings, always current. */
export const useWorkoutData = () => {
    const { data, setData, loaded, reload } = useFocusData(load, EMPTY, { watch: WATCH });
    const [workouts, records, session, cues] = data;

    const changeCues = useCallback(
        (change: Partial<WorkoutCues>) => {
            const next = { ...cues, ...change };
            setData(([w, r, s]) => [w, r, s, next]);
            return setWorkoutCues(next);
        },
        [cues, setData],
    );

    return { workouts, records, session, cues, loaded, reload, changeCues };
};
