import { ApneaKind, ApneaRecord, TableParams, TableRound } from '../types/types';

export type { TableParams };
import { addDays, startOfWeek, toDateKey } from './dates';

/**
 * Pure apnea-training logic: table generation, session plans, formatting and
 * statistics. Durations in tables are seconds; recorded times are milliseconds.
 */

// ---- Tables -------------------------------------------------------------------

export type GeneratedKind = 'co2' | 'o2';

/** Limits for the table editor's controls. */
export const TABLE_LIMITS = {
    hold: { min: 10, max: 600 },
    breathe: { min: 5, max: 600 },
    step: { min: 0, max: 60 },
    rounds: { min: 1, max: 20 },
    /** Every time moves in 5-second increments. */
    increment: 5,
};

/** Shortest hold a custom table allows, in seconds. */
export const MIN_HOLD = TABLE_LIMITS.hold.min;

/** Easy starting templates; everything is editable. */
export const DEFAULT_TABLE_PARAMS: Record<GeneratedKind, TableParams> = {
    co2: { hold: 60, breathe: 60, step: 5, rounds: 8 },
    o2: { hold: 60, breathe: 60, step: 10, rounds: 8 },
};

const clamp = (value: number, { min, max }: { min: number; max: number }) =>
    Math.min(max, Math.max(min, Math.round(value)));

/** Keeps every parameter inside its limits. */
export const normalizeParams = (p: TableParams): TableParams => ({
    hold: clamp(p.hold, TABLE_LIMITS.hold),
    breathe: clamp(p.breathe, TABLE_LIMITS.breathe),
    step: clamp(p.step, TABLE_LIMITS.step),
    rounds: clamp(p.rounds, TABLE_LIMITS.rounds),
});

/** CO₂ table: the same hold every round while the breathe time shrinks by `step` (never below the minimum). */
export const co2Table = (params: TableParams): TableRound[] => {
    const p = normalizeParams(params);
    return Array.from({ length: p.rounds }, (_, i) => ({
        breathe: Math.max(TABLE_LIMITS.breathe.min, p.breathe - i * p.step),
        hold: p.hold,
    }));
};

/** O₂ table: the same breathe time every round while the hold grows by `step`. */
export const o2Table = (params: TableParams): TableRound[] => {
    const p = normalizeParams(params);
    return Array.from({ length: p.rounds }, (_, i) => ({
        breathe: p.breathe,
        hold: Math.min(TABLE_LIMITS.hold.max, p.hold + i * p.step),
    }));
};

export const generateTable = (kind: GeneratedKind, params: TableParams): TableRound[] =>
    kind === 'co2' ? co2Table(params) : o2Table(params);

const snap = (seconds: number) => Math.round(seconds / TABLE_LIMITS.increment) * TABLE_LIMITS.increment;

/**
 * Conventional parameters from a personal best, offered as a suggestion only:
 * CO₂ holds half the best with 2:00 rest shrinking 15 s a round; O₂ grows from
 * 40% to 80% of the best with 2:00 rest.
 */
export const paramsFromBest = (kind: GeneratedKind, bestSec: number): TableParams => {
    const rounds = 8;
    if (kind === 'co2') {
        return normalizeParams({ hold: snap(bestSec * 0.5), breathe: 120, step: 15, rounds });
    }
    const first = snap(bestSec * 0.4);
    const step = Math.max(TABLE_LIMITS.increment, snap((bestSec * 0.8 - first) / (rounds - 1)));
    return normalizeParams({ hold: first, breathe: 120, step, rounds });
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
