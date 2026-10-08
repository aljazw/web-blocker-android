import { ApneaRecord } from '../src/types/types';
import {
    co2Table,
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
    it('keeps the hold fixed at half the PB and shrinks the rest from 2:00 to 0:15', () => {
        const table = co2Table(180, 'normal', 8);
        expect(table).toHaveLength(8);
        expect(table.every(r => r.hold === 90)).toBe(true);
        expect(table[0].breathe).toBe(120);
        expect(table[7].breathe).toBe(15);
        for (let i = 1; i < table.length; i++) {
            expect(table[i].breathe).toBeLessThanOrEqual(table[i - 1].breathe);
        }
    });

    it('snaps every time to 5 seconds', () => {
        const table = co2Table(173, 'hard', 7);
        expect(table.every(r => r.breathe % 5 === 0 && r.hold % 5 === 0)).toBe(true);
    });

    it('never asks for a hold shorter than the minimum', () => {
        expect(co2Table(5, 'easy')[0].hold).toBe(MIN_HOLD);
    });

    it('clamps the number of rounds', () => {
        expect(co2Table(120, 'normal', 1)).toHaveLength(4);
        expect(co2Table(120, 'normal', 40)).toHaveLength(12);
    });
});

describe('o2Table', () => {
    it('keeps the rest fixed and grows the hold up to 80% of the PB', () => {
        const table = o2Table(200, 'normal', 8);
        expect(table.every(r => r.breathe === 120)).toBe(true);
        expect(table[0].hold).toBe(80);
        expect(table[7].hold).toBe(160);
        for (let i = 1; i < table.length; i++) {
            expect(table[i].hold).toBeGreaterThanOrEqual(table[i - 1].hold);
        }
    });

    it('never exceeds 85% of the PB, even on hard', () => {
        const pb = 300;
        expect(Math.max(...o2Table(pb, 'hard').map(r => r.hold))).toBeLessThanOrEqual(pb * 0.85);
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
        expect(tableDuration(co2Table(180, 'normal', 8))).toBeGreaterThan(8 * 90);
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
