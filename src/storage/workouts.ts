import { Exercise, Workout, WorkoutCues, WorkoutRecord, WorkoutSession } from '../types/types';
import {
    KEYS,
    addRecord,
    clampInt,
    isNumber,
    isString,
    parseJson,
    readList,
    readObject,
    readParsed,
    updateList,
    upsertById,
    withoutId,
    writeJson,
    writeRaw,
} from './core';

const MAX_WORKOUT_RECORDS = 1000;
const WORKOUT_PHASES = ['ready', 'work', 'rest', 'done'];

const toExercise = (v: any): Exercise | null =>
    v && isString(v.id) && isString(v.name)
        ? {
              id: v.id,
              name: v.name,
              mode: v.mode === 'time' ? 'time' : 'reps',
              sets: clampInt(v.sets, 1, 10, 3),
              reps: clampInt(v.reps, 1, 200, 10),
              seconds: clampInt(v.seconds, 5, 900, 45),
              rest: clampInt(v.rest, 0, 600, 60),
          }
        : null;

const toExercises = (v: unknown): Exercise[] =>
    Array.isArray(v) ? v.map(toExercise).filter((e): e is Exercise => e !== null) : [];

const toWorkout = (v: any): Workout | null =>
    v && isString(v.id) && isString(v.name) ? { id: v.id, name: v.name, exercises: toExercises(v.exercises) } : null;

const toWorkoutRecord = (v: any): WorkoutRecord | null =>
    v && isString(v.id) && isNumber(v.startedAt) && isNumber(v.setsDone) && isNumber(v.setsTotal)
        ? {
              id: v.id,
              workoutId: isString(v.workoutId) ? v.workoutId : '',
              title: isString(v.title) ? v.title : 'Workout',
              startedAt: v.startedAt,
              endedAt: isNumber(v.endedAt) ? v.endedAt : v.startedAt,
              setsDone: v.setsDone,
              setsTotal: v.setsTotal,
              completed: v.completed === true,
          }
        : null;

const toWorkoutSession = (raw: string | null): WorkoutSession | null => {
    const v: any = parseJson(raw);
    const exercises = toExercises(v?.exercises);
    if (!v || !isString(v.id) || !exercises.length || !WORKOUT_PHASES.includes(v.phase)) {
        return null;
    }
    const exercise = clampInt(v.exercise, 0, exercises.length - 1, 0);
    return {
        id: v.id,
        workoutId: isString(v.workoutId) ? v.workoutId : '',
        title: isString(v.title) ? v.title : 'Workout',
        exercises,
        exercise,
        set: clampInt(v.set, 0, exercises[exercise].sets - 1, 0),
        phase: v.phase,
        phaseStartedAt: isNumber(v.phaseStartedAt) ? v.phaseStartedAt : Date.now(),
        startedAt: isNumber(v.startedAt) ? v.startedAt : Date.now(),
        endedAt: isNumber(v.endedAt) ? v.endedAt : 0,
        setsDone: clampInt(v.setsDone, 0, 10000, 0),
        endedEarly: v.endedEarly === true,
    };
};

const toWorkoutCues = (v: any): WorkoutCues => ({ sound: v.sound !== false, vibration: v.vibration !== false });

export const getWorkouts = (): Promise<Workout[]> => readList(KEYS.workouts, toWorkout);

/** Inserts the workout, or replaces the one with the same id. */
export const saveWorkout = (workout: Workout): Promise<boolean> =>
    updateList(KEYS.workouts, toWorkout, list => upsertById(list, workout));

export const deleteWorkout = (id: string): Promise<boolean> =>
    updateList(KEYS.workouts, toWorkout, list => withoutId(list, id));

export const getWorkoutRecords = (): Promise<WorkoutRecord[]> => readList(KEYS.workoutRecords, toWorkoutRecord);

/** Adds a record; one with the same id is ignored, so a workout can never be saved twice. */
export const addWorkoutRecord = (record: WorkoutRecord): Promise<boolean> =>
    updateList(KEYS.workoutRecords, toWorkoutRecord, list => addRecord(list, record, MAX_WORKOUT_RECORDS));

export const deleteWorkoutRecord = (id: string): Promise<boolean> =>
    updateList(KEYS.workoutRecords, toWorkoutRecord, list => withoutId(list, id));

/** The workout in progress, or null. */
export const getWorkoutSession = (): Promise<WorkoutSession | null> =>
    readParsed(KEYS.workoutSession, toWorkoutSession);

/** Saves the workout in progress; null clears it. */
export const setWorkoutSession = (session: WorkoutSession | null): Promise<boolean> =>
    session ? writeJson(KEYS.workoutSession, session) : writeRaw(KEYS.workoutSession, '');

export const getWorkoutCues = (): Promise<WorkoutCues> => readObject(KEYS.workoutCues, toWorkoutCues);

export const setWorkoutCues = (cues: WorkoutCues): Promise<boolean> => writeJson(KEYS.workoutCues, cues);
