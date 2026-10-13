import { Exercise, Workout } from '../src/types/types';
import {
    completeSet,
    countdown,
    describeExercise,
    endSession,
    estimateMinutes,
    extendRest,
    LEAD_IN_MS,
    nextUp,
    recordFromSession,
    setOrder,
    skipRest,
    skipSet,
    startSession,
    startTimedSet,
    tick,
} from '../src/utils/workout';

const pushups: Exercise = { id: 'a', name: 'Push-ups', mode: 'reps', sets: 2, reps: 10, seconds: 45, rest: 60 };
const plank: Exercise = { id: 'b', name: 'Plank', mode: 'time', sets: 2, reps: 10, seconds: 30, rest: 0 };
const workout: Workout = { id: 'w', name: 'Test', exercises: [pushups, plank] };
const T0 = 1_000_000;

describe('workout session', () => {
    it('rests after a reps set, then waits for the next set', () => {
        let s = startSession(workout, T0);
        s = completeSet(s, T0 + 20_000);
        expect(s).toMatchObject({ phase: 'rest', setsDone: 1, set: 0 });
        expect(tick(s, T0 + 79_000).phase).toBe('rest');
        s = tick(s, T0 + 80_000);
        expect(s).toMatchObject({ phase: 'ready', exercise: 0, set: 1 });
    });

    it('moves to the next exercise after the last set', () => {
        let s = startSession(workout, T0);
        s = skipRest(completeSet(s, T0), T0);
        s = skipRest(completeSet(s, T0), T0);
        expect(s).toMatchObject({ phase: 'ready', exercise: 1, set: 0, setsDone: 2 });
        expect(nextUp(s)?.exercise.name).toBe('Plank');
    });

    it('runs a timed set after the lead-in and finishes on its own', () => {
        let s = { ...startSession(workout, T0), exercise: 1 };
        s = startTimedSet(s, T0);
        expect(countdown(s, T0 + 1000)).toMatchObject({ kind: 'leadIn', remainingMs: LEAD_IN_MS - 1000 });
        expect(countdown(s, T0 + LEAD_IN_MS + 10_000)).toMatchObject({ kind: 'work', remainingMs: 20_000 });
        // No rest on the plank: straight to the second set, waiting for Start.
        s = tick(s, T0 + LEAD_IN_MS + 30_000);
        expect(s).toMatchObject({ phase: 'ready', set: 1, setsDone: 1 });
        s = tick(startTimedSet(s, T0 + 60_000), T0 + 60_000 + LEAD_IN_MS + 30_000);
        expect(s).toMatchObject({ phase: 'done', setsDone: 2, endedEarly: false });
    });

    it('catches up several steps after the app was closed', () => {
        let s = completeSet(startSession(workout, T0), T0);
        s = tick(s, T0 + 10 * 60_000);
        expect(s).toMatchObject({ phase: 'ready', set: 1 });
    });

    it('can extend a rest', () => {
        const s = extendRest(completeSet(startSession(workout, T0), T0), 15);
        expect(tick(s, T0 + 70_000).phase).toBe('rest');
        expect(tick(s, T0 + 75_000).phase).toBe('ready');
    });

    it('counts a skipped set as not done but still reaches the end', () => {
        let s = startSession({ ...workout, exercises: [{ ...pushups, sets: 1 }] }, T0);
        s = skipSet(s, T0 + 5000);
        expect(s.phase).toBe('done');
        expect(recordFromSession(s)).toMatchObject({ setsDone: 0, setsTotal: 1, completed: true });
    });

    it('marks an ended workout as not completed', () => {
        const s = endSession(completeSet(startSession(workout, T0), T0), T0 + 1000);
        expect(recordFromSession(s)).toMatchObject({ setsDone: 1, setsTotal: 4, completed: false });
    });
});

describe('describing', () => {
    it('summarises an exercise', () => {
        expect(describeExercise(pushups)).toBe('2 × 10 reps · rest 1:00');
        expect(describeExercise(plank)).toBe('2 × 0:30');
    });

    it('estimates the duration without the final rest', () => {
        // 2×(30 s + 60 s) + 2×30 s = 240 s
        expect(estimateMinutes([pushups, plank])).toBe(4);
    });
});

describe('circuit workouts', () => {
    const a: Exercise = { id: 'a', name: 'A', mode: 'reps', sets: 3, reps: 10, seconds: 45, rest: 15 };
    const b: Exercise = { id: 'b', name: 'B', mode: 'reps', sets: 3, reps: 10, seconds: 45, rest: 15 };
    const c: Exercise = { id: 'c', name: 'C', mode: 'reps', sets: 2, reps: 10, seconds: 45, rest: 15 };
    const circuit: Workout = { id: 'c', name: 'Circuit', exercises: [a, b, c], circuit: true, roundRest: 90 };

    it('orders sets round by round, dropping exercises with fewer sets', () => {
        expect(setOrder(circuit.exercises, true).map(p => `${p.exercise}${p.set}`)).toEqual([
            '00',
            '10',
            '20',
            '01',
            '11',
            '21',
            '02',
            '12',
        ]);
        expect(setOrder(circuit.exercises, false).map(p => `${p.exercise}${p.set}`)).toEqual([
            '00',
            '01',
            '02',
            '10',
            '11',
            '12',
            '20',
            '21',
        ]);
    });

    it('goes 1 → 2 → 3 each round, with the round rest between rounds', () => {
        let s = startSession(circuit, T0);
        const seen: string[] = [];
        let t = T0;
        while (s.phase !== 'done') {
            seen.push(`${s.exercises[s.exercise].name}${s.set + 1}`);
            s = completeSet(s, t);
            if (s.phase === 'rest') {
                const remaining = countdown(s, t)!.remainingMs;
                seen.push(`rest${remaining / 1000}`);
                t += remaining;
                s = tick(s, t);
            }
        }
        expect(seen).toEqual([
            'A1',
            'rest15',
            'B1',
            'rest15',
            'C1',
            'rest90',
            'A2',
            'rest15',
            'B2',
            'rest15',
            'C2',
            'rest90',
            'A3',
            'rest15',
            'B3',
        ]);
        expect(recordFromSession(s)).toMatchObject({ setsDone: 8, setsTotal: 8, completed: true });
    });

    it('shows the next exercise of the round as up next', () => {
        const s = startSession(circuit, T0);
        expect(nextUp(s)).toMatchObject({ exercise: { name: 'B' }, set: 0 });
    });

    it('counts round rests in the estimate', () => {
        expect(estimateMinutes(circuit.exercises, true, 90)).toBeGreaterThan(estimateMinutes(circuit.exercises, false));
    });
});
