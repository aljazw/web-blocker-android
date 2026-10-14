import { DayPlan, Habit, PlanBlock } from '../src/types/types';
import {
    copyPlan,
    findFreeSlot,
    fitBlock,
    formatDuration,
    formatMinutes,
    gapsBetween,
    isBlockDone,
    motivationFor,
    overlapping,
    parseMinutes,
    planHistory,
    planMoment,
    shiftRemaining,
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

describe('shiftRemaining', () => {
    it('moves only blocks that have not started, for today only', () => {
        const plan: DayPlan = {
            date: SAT,
            blocks: [block('past', 420, 450), block('next', 600, 660), block('late', 1400, 1430)],
        };
        const shifted = shiftRemaining(plan, 500, 30);
        expect(shifted.blocks.map(b => [b.id, b.start, b.end])).toEqual([
            ['past', 420, 450],
            ['next', 630, 690],
            ['late', 1410, 1440], // never past midnight
        ]);
        // Tomorrow's copy goes back to the usual times.
        expect(copyPlan(shifted, '2026-10-11').blocks.map(b => [b.id, b.start, b.end, b.shift])).toEqual([
            ['past', 420, 450, undefined],
            ['next', 600, 660, undefined],
            ['late', 1400, 1430, undefined],
        ]);
    });
});

describe('planHistory', () => {
    it('scores each day of the last week', () => {
        const plans: DayPlan[] = [
            { date: '2026-10-09', blocks: [block('a', 0, 30, { done: true }), block('b', 30, 60)] },
            { date: SAT, blocks: [block('c', 0, 30, { done: true })] },
        ];
        const days = planHistory(plans, [], new Date(2026, 9, 10, 12));
        expect(days).toHaveLength(7);
        expect(days[5]).toMatchObject({ date: '2026-10-09', label: 'F', total: 2, done: 1 });
        expect(days[6]).toMatchObject({ date: SAT, label: 'S', total: 1, done: 1 });
        expect(days[0]).toMatchObject({ total: 0, done: 0 });
    });
});

describe('motivationFor', () => {
    it('is stable for the same seed', () => {
        expect(motivationFor('2026-10-10b1')).toBe(motivationFor('2026-10-10b1'));
    });
});

describe('fitBlock', () => {
    const plan = (...blocks: PlanBlock[]): DayPlan => ({ date: SAT, blocks });
    const times = (blocks: PlanBlock[]) => blocks.map(b => `${b.id} ${b.start}-${b.end}`);

    it('adds a block into free time without touching the rest', () => {
        const fit = fitBlock(plan(block('a', 480, 540), block('c', 720, 780)), [], block('b', 600, 660));
        expect(times(fit.blocks)).toEqual(['a 480-540', 'b 600-660', 'c 720-780']);
        expect(fit.changes).toEqual([]);
        expect(fit.overflow).toBeNull();
    });

    it('pushes later blocks back in a chain, letting gaps absorb the delay', () => {
        const fit = fitBlock(
            plan(block('a', 480, 540), block('b', 540, 600), block('c', 600, 660), block('d', 720, 780)),
            [],
            block('a', 480, 570),
        );
        expect(times(fit.blocks)).toEqual(['a 480-570', 'b 570-630', 'c 630-690', 'd 720-780']);
        expect(fit.changes.map(c => c.after.id)).toEqual(['b', 'c']);
        expect(fit.blocks.find(b => b.id === 'b')!.shift).toBeUndefined();
    });

    it('ends an earlier block when the new one starts', () => {
        const fit = fitBlock(plan(block('work', 540, 720)), [], block('call', 600, 630));
        expect(times(fit.blocks)).toEqual(['work 540-600', 'call 600-630']);
    });

    it('makes a one-off block move the others for this day only', () => {
        const fit = fitBlock(
            plan(block('work', 540, 720), block('lunch', 720, 765)),
            [],
            block('dentist', 690, 750, { once: true }),
        );
        const next = copyPlan({ date: SAT, blocks: fit.blocks }, '2026-10-11');
        expect(times(next.blocks)).toEqual(['work 540-720', 'lunch 720-765']);
    });

    it('reports a block pushed past midnight', () => {
        const fit = fitBlock(plan(block('late', 1380, 1440)), [], block('new', 1350, 1410));
        expect(fit.overflow?.id).toBe('late');
    });

    it('leaves blocks hidden on this day alone', () => {
        const fit = fitBlock(
            plan(block('gym', 600, 660, { habitId: 'h' })),
            [habit('h', { days: WEEKDAYS })],
            block('new', 600, 660),
        );
        expect(times(fit.blocks)).toEqual(['gym 600-660', 'new 600-660']);
    });
});
