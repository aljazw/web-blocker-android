import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { Workout, WorkoutCues, WorkoutRecord, WorkoutSession } from '../types/types';
import { getWorkoutCues, getWorkoutRecords, getWorkouts, getWorkoutSession, setWorkoutCues } from '../utils/storage';
import { logger } from '../utils/logger';

/** Workouts, history, the session in progress and cue settings, reloaded on focus. */
export const useWorkoutData = () => {
    const [workouts, setWorkouts] = useState<Workout[]>([]);
    const [records, setRecords] = useState<WorkoutRecord[]>([]);
    const [session, setSession] = useState<WorkoutSession | null>(null);
    const [cues, setCues] = useState<WorkoutCues>({ sound: true, vibration: true });
    const [loaded, setLoaded] = useState(false);

    const reload = useCallback(async () => {
        try {
            const [w, r, s, c] = await Promise.all([
                getWorkouts(),
                getWorkoutRecords(),
                getWorkoutSession(),
                getWorkoutCues(),
            ]);
            setWorkouts(w);
            setRecords(r);
            setSession(s);
            setCues(c);
        } catch (error) {
            logger.warn('Could not load workouts', error);
        } finally {
            setLoaded(true);
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
            reload();
        }, [reload]),
    );

    const changeCues = useCallback(
        async (change: Partial<WorkoutCues>) => {
            const next = { ...cues, ...change };
            setCues(next);
            return setWorkoutCues(next);
        },
        [cues],
    );

    return { workouts, records, session, cues, loaded, reload, changeCues };
};
