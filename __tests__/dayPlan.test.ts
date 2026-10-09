import { DayPlan, Habit, PlanBlock } from '../src/types/types';
import {
    copyPlan,
    findFreeSlot,
    formatDuration,
    formatMinutes,
    gapsBetween,
    isBlockDone,
    motivationFor,
    overlapping,
    parseMinutes,
    planMoment,
    starterPlan,
    unplannedHabits,
    visibleBlocks,
} from '../src/utils/dayPlan';

// 2026-10-10 is a Saturday.
const SAT = '2026-10-10';
const EVERY_DAY = [true, true, true, true, true, true, true];
const WEEKDAYS = [true, true, true, true, true, false, false];

const block = (id: string, start: number, end: number, over: Partial<PlanBlock> = {}): PlanBlock => ({
    id,
    title: id,
    icon: 'Target',
    start,
    end,
    ...over,
});

const habit = (id: string, over: Partial<Habit> = {}): Habit => ({
    id,
    title: id,
    icon: 'Dumbbell',
    days: EVERY_DAY,
    reminder: null,
    createdAt: '2026-09-01',
    completions: [],
    ...over,
});

describe('time helpers', () => {
    it('formats and parses minutes', () => {
        expect(formatMinutes(450)).toBe('07:30');
        expect(formatMinutes(1440)).toBe('24:00');
        expect(parseMinutes('07:30')).toBe(450);
        expect(parseMinutes('24:00')).toBeNull();
        expect(parseMinutes('7:5')).toBeNull();
    });

    it('formats durations', () => {
        expect(formatDuration(45)).toBe('45 min');
        expect(formatDuration(60)).toBe('1 h');
        expect(formatDuration(90)).toBe('1 h 30 min');
    });
});

describe('copyPlan', () => {
    it('copies blocks to the new day, unchecked and without one-offs', () => {
        const previous: DayPlan = {
            date: '2026-10-09',
            blocks: [block('lunch', 750, 795, { done: true }), block('dentist', 900, 960, { once: true })],
        };
        const next = copyPlan(previous, SAT);
        expect(next.date).toBe(SAT);
        expect(next.blocks).toEqual([block('lunch', 750, 795)]);
    });
});

describe('visibleBlocks', () => {
    it('hides blocks of habits that are not due, or deleted, but keeps them in the plan', () => {
        const plan: DayPlan = {
            date: SAT,
            blocks: [
                block('gym', 1020, 1080, { habitId: 'weekday' }),
                block('read', 1260, 1290, { habitId: 'daily' }),
                block('gone', 600, 630, { habitId: 'deleted' }),
                block('lunch', 750, 795),
            ],
        };
        const habits = [habit('weekday', { days: WEEKDAYS }), habit('daily')];
        expect(visibleBlocks(plan, habits).map(b => b.id)).toEqual(['lunch', 'read']);
        expect(plan.blocks).toHaveLength(4);
    });
});

describe('isBlockDone', () => {
    it('follows the linked habit, or the block flag', () => {
        const h = habit('read', { completions: [SAT] });
        expect(isBlockDone(block('a', 0, 30, { habitId: 'read' }), [h], SAT)).toBe(true);
        expect(isBlockDone(block('a', 0, 30, { habitId: 'read' }), [h], '2026-10-11')).toBe(false);
        expect(isBlockDone(block('b', 0, 30, { done: true }), [], SAT)).toBe(true);
        expect(isBlockDone(block('c', 0, 30), [], SAT)).toBe(false);
    });
});

describe('gaps and slots', () => {
    const blocks = [block('a', 420, 450), block('b', 450, 480), block('c', 540, 600), block('d', 605, 660)];

    it('finds free time between blocks, ignoring tiny gaps', () => {
        expect(gapsBetween(blocks)).toEqual([{ start: 480, end: 540 }]);
    });

    it('finds the first free slot that fits', () => {
        expect(findFreeSlot(blocks, 30, 420)).toBe(480);
        expect(findFreeSlot(blocks, 90, 420)).toBe(660);
        expect(findFreeSlot(blocks, 30, 701)).toBe(705);
    });

    it('flags overlaps', () => {
        expect([...overlapping([block('x', 0, 60), block('y', 30, 90), block('z', 90, 120)])].sort()).toEqual([
            'x',
            'y',
        ]);
    });
});

describe('planMoment', () => {
    const blocks = [block('a', 420, 450), block('b', 540, 600)];

    it('knows what is on now', () => {
        expect(planMoment([], 500)).toEqual({ kind: 'empty' });
        expect(planMoment(blocks, 400)).toMatchObject({ kind: 'before', next: { id: 'a' } });
        expect(planMoment(blocks, 430)).toMatchObject({ kind: 'during', block: { id: 'a' }, next: { id: 'b' } });
        expect(planMoment(blocks, 500)).toMatchObject({ kind: 'free', until: 540 });
        expect(planMoment(blocks, 600)).toEqual({ kind: 'after' });
    });
});

describe('starterPlan', () => {
    it('fits a typical day between wake-up and bedtime and slots in due habits', () => {
        const habits = [
            habit('Workout'),
            habit('Read 10 pages', { icon: 'Book', reminder: '21:00' }),
            habit('Weekday only', { days: WEEKDAYS }),
        ];
        const plan = starterPlan(SAT, habits, { wake: '07:00', bedtime: '23:00' });
        const byTitle = Object.fromEntries(plan.blocks.map(b => [b.title, b]));

        expect(byTitle['Morning routine'].start).toBe(420);
        expect(byTitle['Wind down']).toMatchObject({ start: 1335, end: 1380 });
        // The generic "Workout" block becomes the linked habit instead of a duplicate.
        expect(byTitle.Workout.habitId).toBe('Workout');
        expect(plan.blocks.filter(b => b.title === 'Workout')).toHaveLength(1);
        expect(byTitle['Read 10 pages']).toMatchObject({ start: 1260, habitId: 'Read 10 pages' });
        expect(byTitle['Weekday only']).toBeUndefined();
        expect(overlapping(plan.blocks).size).toBe(0);
        expect(plan.blocks.every(b => b.start >= 420 && b.end <= 1380)).toBe(true);
    });
});

describe('unplannedHabits', () => {
    it('lists habits due that day without a block', () => {
        const plan: DayPlan = { date: SAT, blocks: [block('r', 0, 30, { habitId: 'read' })] };
        const habits = [habit('read'), habit('walk'), habit('weekday', { days: WEEKDAYS })];
        expect(unplannedHabits(plan, habits).map(h => h.id)).toEqual(['walk']);
    });
});

describe('motivationFor', () => {
    it('is stable for the same seed', () => {
        expect(motivationFor('2026-10-10b1')).toBe(motivationFor('2026-10-10b1'));
    });
});
