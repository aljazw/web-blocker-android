import { ApneaKind, ApneaRecord, Difficulty, TableRound } from '../types/types';
import { addDays, startOfWeek, toDateKey } from './dates';

/**
 * Pure apnea-training logic: table generation, session plans, formatting and
 * statistics. Durations in tables are seconds; recorded times are milliseconds.
 */

// ---- Tables -------------------------------------------------------------------

export const ROUNDS = { min: 4, max: 12, default: 8 };
/** Shortest hold a generated table will ask for, in seconds. */
export const MIN_HOLD = 10;
/** Generated times snap to this many seconds, so tables read cleanly. */
const STEP = 5;

interface TableProfile {
    /** CO2: fixed hold as a share of the personal best. */
    co2Hold: number;
    /** CO2: rest shrinks linearly from start to end, in seconds. */
    co2RestStart: number;
    co2RestEnd: number;
    /** O2: hold grows linearly between these shares of the personal best. */
    o2HoldStart: number;
    o2HoldEnd: number;
    /** O2: fixed rest, in seconds. */
    o2Rest: number;
}

/**
 * Conventional static-apnea table parameters. The O2 table never goes past
 * 85% of the personal best; maximal attempts belong in a max test, not a table.
 */
export const DIFFICULTY: Record<Difficulty, TableProfile & { label: string }> = {
    easy: {
        label: 'Easy',
        co2Hold: 0.4,
        co2RestStart: 120,
        co2RestEnd: 30,
        o2HoldStart: 0.35,
        o2HoldEnd: 0.7,
        o2Rest: 120,
    },
    normal: {
        label: 'Normal',
        co2Hold: 0.5,
        co2RestStart: 120,
        co2RestEnd: 15,
        o2HoldStart: 0.4,
        o2HoldEnd: 0.8,
        o2Rest: 120,
    },
    hard: {
        label: 'Hard',
        co2Hold: 0.6,
        co2RestStart: 105,
        co2RestEnd: 15,
        o2HoldStart: 0.45,
        o2HoldEnd: 0.85,
        o2Rest: 105,
    },
};

const snap = (seconds: number) => Math.round(seconds / STEP) * STEP;
const lerp = (from: number, to: number, t: number) => from + (to - from) * t;
const clampRounds = (rounds: number) => Math.min(ROUNDS.max, Math.max(ROUNDS.min, Math.round(rounds)));
/** 0 for the first round, 1 for the last. */
const progressOf = (index: number, rounds: number) => (rounds <= 1 ? 0 : index / (rounds - 1));

/** CO2 tolerance table: the same hold every round while the rest between holds shrinks. */
export const co2Table = (personalBestSec: number, difficulty: Difficulty, rounds = ROUNDS.default): TableRound[] => {
    const p = DIFFICULTY[difficulty];
    const n = clampRounds(rounds);
    const hold = Math.max(MIN_HOLD, snap(personalBestSec * p.co2Hold));
    return Array.from({ length: n }, (_, i) => ({
        breathe: Math.max(STEP, snap(lerp(p.co2RestStart, p.co2RestEnd, progressOf(i, n)))),
        hold,
    }));
};

/** O2 (hypoxia) table: the same rest every round while the hold grows. */
export const o2Table = (personalBestSec: number, difficulty: Difficulty, rounds = ROUNDS.default): TableRound[] => {
    const p = DIFFICULTY[difficulty];
    const n = clampRounds(rounds);
    return Array.from({ length: n }, (_, i) => ({
        breathe: p.o2Rest,
        hold: Math.max(MIN_HOLD, snap(personalBestSec * lerp(p.o2HoldStart, p.o2HoldEnd, progressOf(i, n)))),
    }));
};

/** Total length of a table in seconds. */
export const tableDuration = (rounds: TableRound[]): number => rounds.reduce((sum, r) => sum + r.breathe + r.hold, 0);

// ---- Session plans --------------------------------------------------------------

export type PhaseType = 'prepare' | 'breathe' | 'hold' | 'inhale' | 'holdIn' | 'exhale' | 'holdOut';

/** One step the native timer runs. durationMs < 0 = open-ended (ends on tap). */
export interface SessionPhase {
    type: PhaseType;
    durationMs: number;
    round: number;
}

export const OPEN_ENDED = -1;

export const tablePhases = (rounds: TableRound[]): SessionPhase[] =>
    rounds.flatMap((r, i) => {
        const round = i + 1;
        const hold: SessionPhase = { type: 'hold', durationMs: r.hold * 1000, round };
        // A zero rest (allowed in custom tables) means back-to-back holds.
        return r.breathe > 0 ? [{ type: 'breathe', durationMs: r.breathe * 1000, round }, hold] : [hold];
    });

/** Max-hold test: optional breathe-up, then a hold that runs until the user stops it. */
export const maxTestPhases = (breatheUpSec: number): SessionPhase[] => [
    ...(breatheUpSec > 0 ? [{ type: 'prepare' as const, durationMs: breatheUpSec * 1000, round: 1 }] : []),
    { type: 'hold', durationMs: OPEN_ENDED, round: 1 },
];

export interface BreathingExercise {
    id: string;
    name: string;
    /** The rhythm at a glance, e.g. "4 · 4 · 4 · 4". */
    rhythm: string;
    description: string;
    pattern: { type: PhaseType; seconds: number }[];
}

export const BREATHING_EXERCISES: BreathingExercise[] = [
    {
        id: 'box',
        name: 'Box breathing',
        rhythm: '4 · 4 · 4 · 4',
        description: 'Inhale, hold, exhale and hold for equal counts. Steadies the mind and sharpens focus.',
        pattern: [
            { type: 'inhale', seconds: 4 },
            { type: 'holdIn', seconds: 4 },
            { type: 'exhale', seconds: 4 },
            { type: 'holdOut', seconds: 4 },
        ],
    },
    {
        id: 'breatheUp',
        name: 'Breathe-up',
        rhythm: '4 · 8',
        description: 'Relaxed 1:2 breathing freedivers use before a hold. Passive, slow exhales; never hyperventilate.',
        pattern: [
            { type: 'inhale', seconds: 4 },
            { type: 'exhale', seconds: 8 },
        ],
    },
    {
        id: 'relax',
        name: '4-7-8 relaxation',
        rhythm: '4 · 7 · 8',
        description: 'A long hold and slow exhale that lower the heart rate. Good before training or sleep.',
        pattern: [
            { type: 'inhale', seconds: 4 },
            { type: 'holdIn', seconds: 7 },
            { type: 'exhale', seconds: 8 },
        ],
    },
    {
        id: 'resonance',
        name: 'Resonance breathing',
        rhythm: '5.5 · 5.5',
        description: 'About six breaths a minute, the rate that maximises heart-rate variability.',
        pattern: [
            { type: 'inhale', seconds: 5.5 },
            { type: 'exhale', seconds: 5.5 },
        ],
    },
];

/** Whole cycles of the exercise filling roughly `minutes`. */
export const exercisePhases = (exercise: BreathingExercise, minutes: number): SessionPhase[] => {
    const cycleSec = exercise.pattern.reduce((sum, step) => sum + step.seconds, 0);
    const cycles = Math.max(1, Math.round((minutes * 60) / cycleSec));
    return Array.from({ length: cycles }, (_, i) =>
        exercise.pattern.map(step => ({ type: step.type, durationMs: Math.round(step.seconds * 1000), round: i + 1 })),
    ).flat();
};

export const PHASE_LABEL: Record<PhaseType, string> = {
    prepare: 'Breathe up',
    breathe: 'Breathe',
    hold: 'Hold',
    inhale: 'Inhale',
    holdIn: 'Hold',
    exhale: 'Exhale',
    holdOut: 'Hold empty',
};

// ---- Formatting -----------------------------------------------------------------

const pad2 = (n: number) => String(n).padStart(2, '0');

/** "m:ss" from milliseconds, rounded down (elapsed time). */
export const formatClock = (ms: number): string => {
    const total = Math.max(0, Math.floor(ms / 1000));
    return `${Math.floor(total / 60)}:${pad2(total % 60)}`;
};

/** "m:ss" from milliseconds, rounded up, so a countdown shows 0:01 until it really ends. */
export const formatCountdown = (ms: number): string => formatClock(Math.ceil(Math.max(0, ms) / 1000) * 1000);

export const formatSeconds = (seconds: number): string => formatClock(seconds * 1000);

/** "24 min" / "1 h 5 min" for longer spans. */
export const formatMinutes = (seconds: number): string => {
    const minutes = Math.max(1, Math.round(seconds / 60));
    return minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
};

// ---- Records & statistics -------------------------------------------------------

export const KIND_LABEL: Record<ApneaKind, string> = {
    co2: 'CO₂ table',
    o2: 'O₂ table',
    custom: 'Custom table',
    pb: 'Max hold',
    breathing: 'Breathing',
};

export const longestHold = (record: ApneaRecord): number => record.holds.reduce((max, h) => Math.max(max, h), 0);

const maxTests = (records: ApneaRecord[]) => records.filter(r => r.kind === 'pb' && r.holds.length > 0);

/** Best max-hold result (tests and manual entries). Table holds don't count. */
export const personalBest = (records: ApneaRecord[]): { ms: number; record: ApneaRecord } | null =>
    maxTests(records).reduce<{ ms: number; record: ApneaRecord } | null>((best, record) => {
        const ms = longestHold(record);
        return !best || ms > best.ms ? { ms, record } : best;
    }, null);

/** Max-hold results, oldest first, for the progress chart. */
export const maxHoldHistory = (records: ApneaRecord[]): { at: number; ms: number }[] =>
    maxTests(records)
        .map(r => ({ at: r.startedAt, ms: longestHold(r) }))
        .sort((a, b) => a.at - b.at);

export interface TrainingStats {
    sessionsThisWeek: number;
    holdMsThisWeek: number;
    /** Consecutive days with a session, ending today (or yesterday, if today is still open). */
    streakDays: number;
}

export const trainingStats = (records: ApneaRecord[], now: Date = new Date()): TrainingStats => {
    const trained = records.filter(r => !r.manual);
    const weekStart = startOfWeek(now).getTime();
    const thisWeek = trained.filter(r => r.startedAt >= weekStart);

    const days = new Set(trained.map(r => toDateKey(new Date(r.startedAt))));
    let day = days.has(toDateKey(now)) ? now : addDays(now, -1);
    let streakDays = 0;
    while (days.has(toDateKey(day)) && streakDays < 3660) {
        streakDays++;
        day = addDays(day, -1);
    }

    return {
        sessionsThisWeek: thisWeek.length,
        holdMsThisWeek: thisWeek.reduce((sum, r) => sum + r.holds.reduce((a, b) => a + b, 0), 0),
        streakDays,
    };
};

/** First contraction of each hold that had one, in ms. */
export const firstContractions = (record: ApneaRecord): number[] =>
    record.contractions.map(c => c[0]).filter((ms): ms is number => typeof ms === 'number');

/** One line describing the outcome, for lists. */
export const recordSummary = (record: ApneaRecord): string => {
    if (record.kind === 'pb') {
        return record.manual ? 'Entered manually' : `Max ${formatClock(longestHold(record))}`;
    }
    if (record.kind === 'breathing') {
        return formatMinutes((record.endedAt - record.startedAt) / 1000);
    }
    const rounds = `${record.holds.length}/${record.planned} rounds`;
    return record.holds.length ? `${rounds} · longest ${formatClock(longestHold(record))}` : rounds;
};

// ---- Native session results -----------------------------------------------------

export type SessionStatus = 'idle' | 'running' | 'paused' | 'finished';

/** The native timer's state, as returned by the ApneaSession module. */
export interface SessionState {
    status: SessionStatus;
    id: string;
    kind: ApneaKind;
    title: string;
    phases: SessionPhase[];
    index: number;
    phaseElapsedMs: number;
    holds: number[];
    contractions: number[][];
    startedAt: number;
    endedAt: number;
    completed: boolean;
}

const KINDS: ApneaKind[] = ['co2', 'o2', 'custom', 'pb', 'breathing'];
export const isApneaKind = (v: unknown): v is ApneaKind => KINDS.includes(v as ApneaKind);

/** Shortest session worth keeping in history. */
const MIN_BREATHING_MS = 30_000;
const MIN_MAX_HOLD_MS = 5_000;

/** Turns a finished session into a history record, or null if too little happened to keep. */
export const recordFromSession = (s: SessionState): ApneaRecord | null => {
    const holdPhases = s.phases.filter(p => p.type === 'hold');
    const record: ApneaRecord = {
        id: s.id,
        kind: s.kind,
        title: s.title,
        startedAt: s.startedAt,
        endedAt: s.endedAt || Date.now(),
        completed: s.completed,
        holds: s.holds,
        targets: holdPhases.slice(0, s.holds.length).map(p => p.durationMs),
        contractions: s.holds.map((_, i) => s.contractions[i] ?? []),
        planned: holdPhases.length,
    };
    if (s.kind === 'breathing') {
        return record.endedAt - record.startedAt >= MIN_BREATHING_MS ? record : null;
    }
    if (s.kind === 'pb') {
        return longestHold(record) >= MIN_MAX_HOLD_MS ? record : null;
    }
    return record.holds.length > 0 ? record : null;
};
