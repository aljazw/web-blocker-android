import { ApneaRecord } from '../src/types/types';
import {
    co2Table,
    DEFAULT_TABLE_PARAMS,
    generateTable,
    paramsFromBest,
    TABLE_LIMITS,
    exercisePhases,
    BREATHING_EXERCISES,
    formatClock,
    formatCountdown,
    maxTestPhases,
    MIN_HOLD,
    o2Table,
    personalBest,
    recordFromSession,
    SessionState,
    tableDuration,
    tablePhases,
    trainingStats,
} from '../src/utils/apnea';

const record = (overrides: Partial<ApneaRecord>): ApneaRecord => ({
    id: Math.random().toString(36),
    kind: 'co2',
    title: 'CO₂ table',
    startedAt: new Date(2026, 9, 8, 9).getTime(),
    endedAt: new Date(2026, 9, 8, 9, 20).getTime(),
    completed: true,
    holds: [60_000],
    targets: [60_000],
    contractions: [[]],
    planned: 1,
    ...overrides,
});

describe('co2Table', () => {
    it('keeps the hold fixed and shortens the breathe time by the step each round', () => {
        const table = co2Table({ hold: 60, breathe: 60, step: 5, rounds: 8 });
        expect(table).toHaveLength(8);
        expect(table.every(r => r.hold === 60)).toBe(true);
        expect(table.map(r => r.breathe)).toEqual([60, 55, 50, 45, 40, 35, 30, 25]);
    });

    it('never lets the breathe time drop below the minimum', () => {
        const table = co2Table({ hold: 60, breathe: 30, step: 15, rounds: 6 });
        expect(Math.min(...table.map(r => r.breathe))).toBe(TABLE_LIMITS.breathe.min);
    });

    it('clamps parameters to their limits', () => {
        expect(co2Table({ hold: 1, breathe: 60, step: 5, rounds: 99 })).toHaveLength(TABLE_LIMITS.rounds.max);
        expect(co2Table({ hold: 1, breathe: 60, step: 5, rounds: 4 })[0].hold).toBe(MIN_HOLD);
    });
});

describe('o2Table', () => {
    it('keeps the breathe time fixed and lengthens the hold by the step each round', () => {
        const table = o2Table(DEFAULT_TABLE_PARAMS.o2);
        expect(table.every(r => r.breathe === 60)).toBe(true);
        expect(table.map(r => r.hold)).toEqual([60, 70, 80, 90, 100, 110, 120, 130]);
    });

    it('works without a personal best, from the default template', () => {
        expect(generateTable('co2', DEFAULT_TABLE_PARAMS.co2)[0]).toEqual({ breathe: 60, hold: 60 });
    });
});

describe('paramsFromBest', () => {
    it('suggests a CO2 hold of half the best with 2:00 shrinking 15 s', () => {
        expect(paramsFromBest('co2', 180)).toEqual({ hold: 90, breathe: 120, step: 15, rounds: 8 });
    });

    it('suggests O2 holds growing from 40% to about 80% of the best', () => {
        const table = o2Table(paramsFromBest('o2', 200));
        expect(table[0].hold).toBe(80);
        expect(table[table.length - 1].hold).toBeLessThanOrEqual(165);
        expect(table[table.length - 1].hold).toBeGreaterThanOrEqual(150);
    });
});

describe('session plans', () => {
    it('alternates breathe and hold, skipping zero rests', () => {
        const phases = tablePhases([
            { breathe: 60, hold: 30 },
            { breathe: 0, hold: 45 },
        ]);
        expect(phases.map(p => `${p.type}:${p.durationMs}:${p.round}`)).toEqual([
            'breathe:60000:1',
            'hold:30000:1',
            'hold:45000:2',
        ]);
    });

    it('ends a max test with an open-ended hold', () => {
        expect(maxTestPhases(120).map(p => p.type)).toEqual(['prepare', 'hold']);
        expect(maxTestPhases(0)).toEqual([{ type: 'hold', durationMs: -1, round: 1 }]);
    });

    it('fills the requested minutes with whole breathing cycles', () => {
        const box = BREATHING_EXERCISES.find(e => e.id === 'box')!;
        const phases = exercisePhases(box, 2); // 16 s cycles
        expect(phases).toHaveLength(8 * 4);
        expect(phases[phases.length - 1].round).toBe(8);
    });

    it('sums a table duration', () => {
        expect(tableDuration(co2Table(DEFAULT_TABLE_PARAMS.co2))).toBe(8 * 60 + (60 + 25) * 4);
    });
});

describe('formatting', () => {
    it('formats elapsed time rounding down and countdowns rounding up', () => {
        expect(formatClock(0)).toBe('0:00');
        expect(formatClock(61_900)).toBe('1:01');
        expect(formatCountdown(200)).toBe('0:01');
        expect(formatCountdown(60_000)).toBe('1:00');
        expect(formatCountdown(-5)).toBe('0:00');
    });
});

describe('records', () => {
    it('takes the personal best from max tests only', () => {
        const records = [
            record({ kind: 'co2', holds: [400_000] }),
            record({ kind: 'pb', holds: [150_000] }),
            record({ kind: 'pb', holds: [190_000], manual: true }),
        ];
        expect(personalBest(records)?.ms).toBe(190_000);
        expect(personalBest([record({ kind: 'o2' })])).toBeNull();
    });

    it('counts a streak of consecutive training days, allowing today to be open', () => {
        const now = new Date(2026, 9, 8, 20);
        const day = (d: number) => record({ startedAt: new Date(2026, 9, d, 8).getTime() });
        expect(trainingStats([day(7), day(6), day(4)], now).streakDays).toBe(2);
        expect(trainingStats([day(8), day(7)], now).streakDays).toBe(2);
        expect(trainingStats([day(5)], now).streakDays).toBe(0);
    });

    it('sums this week only, ignoring manual entries', () => {
        const now = new Date(2026, 9, 8, 20); // Thursday
        const stats = trainingStats(
            [
                record({ startedAt: new Date(2026, 9, 6, 8).getTime(), holds: [30_000, 40_000] }),
                record({ startedAt: new Date(2026, 9, 1, 8).getTime(), holds: [99_000] }), // last week
                record({ kind: 'pb', manual: true, startedAt: now.getTime(), holds: [200_000] }),
            ],
            now,
        );
        expect(stats.sessionsThisWeek).toBe(1);
        expect(stats.holdMsThisWeek).toBe(70_000);
    });
});

describe('recordFromSession', () => {
    const session = (overrides: Partial<SessionState>): SessionState => ({
        status: 'finished',
        id: 's1',
        kind: 'co2',
        title: 'CO₂ table',
        phases: tablePhases([
            { breathe: 60, hold: 30 },
            { breathe: 45, hold: 30 },
        ]),
        index: 4,
        phaseElapsedMs: 0,
        holds: [30_000, 30_000],
        contractions: [[20_000], [15_000, 25_000]],
        startedAt: 1000,
        endedAt: 200_000,
        completed: true,
        ...overrides,
    });

    it('keeps targets aligned with the holds that happened', () => {
        const r = recordFromSession(session({ holds: [30_000], contractions: [[20_000], []], completed: false }))!;
        expect(r.planned).toBe(2);
        expect(r.targets).toEqual([30_000]);
        expect(r.contractions).toEqual([[20_000]]);
    });

    it('drops sessions where nothing meaningful happened', () => {
        expect(recordFromSession(session({ holds: [], contractions: [] }))).toBeNull();
        expect(recordFromSession(session({ kind: 'pb', holds: [2_000] }))).toBeNull();
        expect(recordFromSession(session({ kind: 'breathing', holds: [], startedAt: 0, endedAt: 10_000 }))).toBeNull();
    });
});
