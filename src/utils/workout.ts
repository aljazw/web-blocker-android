import { Exercise, Workout, WorkoutRecord, WorkoutSession } from '../types/types';
import { newId } from './dates';
import { formatSeconds } from './apnea';

/** Countdown before a timed set starts, so there's time to get into position. */
export const LEAD_IN_MS = 5000;

/** Rough time per rep, only for the duration estimate. */
const SECONDS_PER_REP = 3;

export const LIMITS = {
    sets: { min: 1, max: 10 },
    reps: { min: 1, max: 200 },
    seconds: { min: 5, max: 900, step: 5 },
    rest: { min: 0, max: 600, step: 15 },
};

export const newExercise = (): Exercise => ({
    id: newId('e'),
    name: '',
    mode: 'reps',
    sets: 3,
    reps: 10,
    seconds: 45,
    rest: 60,
});

// ---- Describing ---------------------------------------------------------------

export const totalSets = (exercises: Exercise[]) => exercises.reduce((sum, e) => sum + e.sets, 0);

/** "10 reps" or "0:45". */
export const describeTarget = (e: Exercise) => (e.mode === 'reps' ? `${e.reps} reps` : formatSeconds(e.seconds));

/** "3 × 10 reps · rest 1:00". */
export const describeExercise = (e: Exercise) =>
    `${e.sets} × ${describeTarget(e)}${e.rest ? ` · rest ${formatSeconds(e.rest)}` : ''}`;

/** Estimated minutes, rest after the very last set excluded. */
export const estimateMinutes = (exercises: Exercise[]) => {
    const seconds = exercises.reduce(
        (sum, e) => sum + e.sets * ((e.mode === 'reps' ? e.reps * SECONDS_PER_REP : e.seconds) + e.rest),
        0,
    );
    const lastRest = exercises.length ? exercises[exercises.length - 1].rest : 0;
    return Math.max(1, Math.round((seconds - lastRest) / 60));
};

export const describeWorkout = (w: Workout) => {
    const n = w.exercises.length;
    if (!n) {
        return 'No exercises yet';
    }
    return `${n} exercise${n === 1 ? '' : 's'} · ${totalSets(w.exercises)} sets · ~${estimateMinutes(w.exercises)} min`;
};

// ---- Session state machine ------------------------------------------------------

export const startSession = (workout: Workout, now: number): WorkoutSession => ({
    id: newId('ws'),
    workoutId: workout.id,
    title: workout.name,
    exercises: workout.exercises.map(e => ({ ...e })),
    exercise: 0,
    set: 0,
    phase: 'ready',
    phaseStartedAt: now,
    startedAt: now,
    endedAt: 0,
    setsDone: 0,
    endedEarly: false,
});

export const currentExercise = (s: WorkoutSession): Exercise | undefined => s.exercises[s.exercise];

const isLastSet = (s: WorkoutSession) =>
    s.exercise >= s.exercises.length - 1 && s.set >= (currentExercise(s)?.sets ?? 1) - 1;

/** The set after the current one, or null when this is the last. */
export const nextUp = (s: WorkoutSession): { exercise: Exercise; set: number } | null => {
    const e = currentExercise(s);
    if (!e || isLastSet(s)) {
        return null;
    }
    return s.set < e.sets - 1 ? { exercise: e, set: s.set + 1 } : { exercise: s.exercises[s.exercise + 1], set: 0 };
};

const finish = (s: WorkoutSession, now: number): WorkoutSession => ({
    ...s,
    phase: 'done',
    endedAt: now,
    phaseStartedAt: now,
});

/** Move to the next set (or exercise), waiting for the user. */
const advance = (s: WorkoutSession, now: number): WorkoutSession => {
    if (isLastSet(s)) {
        return finish(s, now);
    }
    const e = currentExercise(s)!;
    return s.set < e.sets - 1
        ? { ...s, set: s.set + 1, phase: 'ready', phaseStartedAt: now }
        : { ...s, exercise: s.exercise + 1, set: 0, phase: 'ready', phaseStartedAt: now };
};

/** Starts a timed set after the get-ready lead-in. Reps sets need no start. */
export const startTimedSet = (s: WorkoutSession, now: number): WorkoutSession =>
    s.phase === 'ready' && currentExercise(s)?.mode === 'time'
        ? { ...s, phase: 'work', phaseStartedAt: now + LEAD_IN_MS }
        : s;

/** Counts the current set as done, then rests or moves on. */
export const completeSet = (s: WorkoutSession, now: number): WorkoutSession => {
    if (s.phase !== 'ready' && s.phase !== 'work') {
        return s;
    }
    const done = { ...s, setsDone: s.setsDone + 1 };
    if (isLastSet(done)) {
        return finish(done, now);
    }
    const rest = currentExercise(done)?.rest ?? 0;
    return rest > 0 ? { ...done, phase: 'rest', phaseStartedAt: now } : advance(done, now);
};

/** Moves past the current set without counting it. */
export const skipSet = (s: WorkoutSession, now: number): WorkoutSession =>
    s.phase === 'ready' || s.phase === 'work' ? advance(s, now) : s;

export const skipRest = (s: WorkoutSession, now: number): WorkoutSession => (s.phase === 'rest' ? advance(s, now) : s);

/** Lengthens the current rest. */
export const extendRest = (s: WorkoutSession, seconds: number): WorkoutSession =>
    s.phase === 'rest' ? { ...s, phaseStartedAt: s.phaseStartedAt + seconds * 1000 } : s;

/** Ends before the last set. */
export const endSession = (s: WorkoutSession, now: number): WorkoutSession =>
    s.phase === 'done' ? s : { ...finish(s, now), endedEarly: true };

/**
 * Applies everything the clock has decided since the last call: a timed set
 * running out, a rest ending. Loops, so returning to the app after a while
 * catches up correctly. Each step uses the exact moment it happened.
 */
export const tick = (s: WorkoutSession, now: number): WorkoutSession => {
    let state = s;
    for (let guard = 0; guard < 1000; guard++) {
        const e = currentExercise(state);
        if (state.phase === 'work' && e) {
            const end = state.phaseStartedAt + e.seconds * 1000;
            if (now < end) {
                return state;
            }
            state = completeSet(state, end);
        } else if (state.phase === 'rest' && e) {
            const end = state.phaseStartedAt + e.rest * 1000;
            if (now < end) {
                return state;
            }
            state = advance(state, end);
        } else {
            return state;
        }
    }
    return state;
};

/**
 * What the countdown shows: the lead-in before a timed set, the set itself, or
 * the rest. Null when nothing is counting down.
 */
export const countdown = (
    s: WorkoutSession,
    now: number,
): { kind: 'leadIn' | 'work' | 'rest'; remainingMs: number; totalMs: number } | null => {
    const e = currentExercise(s);
    if (!e) {
        return null;
    }
    if (s.phase === 'work') {
        if (now < s.phaseStartedAt) {
            return { kind: 'leadIn', remainingMs: s.phaseStartedAt - now, totalMs: LEAD_IN_MS };
        }
        const total = e.seconds * 1000;
        return { kind: 'work', remainingMs: Math.max(0, total - (now - s.phaseStartedAt)), totalMs: total };
    }
    if (s.phase === 'rest') {
        const total = e.rest * 1000;
        return { kind: 'rest', remainingMs: Math.max(0, total - (now - s.phaseStartedAt)), totalMs: total };
    }
    return null;
};

export const recordFromSession = (s: WorkoutSession): WorkoutRecord => {
    const setsTotal = totalSets(s.exercises);
    return {
        id: s.id,
        workoutId: s.workoutId,
        title: s.title,
        startedAt: s.startedAt,
        endedAt: s.endedAt || s.startedAt,
        setsDone: s.setsDone,
        setsTotal,
        completed: s.phase === 'done' && !s.endedEarly,
    };
};

// ---- History ------------------------------------------------------------------

/** Records started on or after `since` (millis). */
export const recordsSince = (records: WorkoutRecord[], since: number) => records.filter(r => r.startedAt >= since);

export const STARTER_WORKOUTS: Omit<Workout, 'id'>[] = [
    {
        name: 'Full body basics',
        exercises: [
            { id: 'e1', name: 'Push-ups', mode: 'reps', sets: 3, reps: 10, seconds: 45, rest: 60 },
            { id: 'e2', name: 'Squats', mode: 'reps', sets: 3, reps: 15, seconds: 45, rest: 60 },
            { id: 'e3', name: 'Lunges (each leg)', mode: 'reps', sets: 3, reps: 10, seconds: 45, rest: 60 },
            { id: 'e4', name: 'Plank', mode: 'time', sets: 3, reps: 10, seconds: 45, rest: 45 },
        ],
    },
    {
        name: 'Core 10',
        exercises: [
            { id: 'e1', name: 'Plank', mode: 'time', sets: 2, reps: 10, seconds: 60, rest: 30 },
            { id: 'e2', name: 'Side plank (each side)', mode: 'time', sets: 2, reps: 10, seconds: 30, rest: 20 },
            { id: 'e3', name: 'Hollow hold', mode: 'time', sets: 2, reps: 10, seconds: 30, rest: 30 },
            { id: 'e4', name: 'Crunches', mode: 'reps', sets: 2, reps: 20, seconds: 45, rest: 30 },
        ],
    },
];
