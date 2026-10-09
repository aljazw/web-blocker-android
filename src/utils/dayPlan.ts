/** Pure logic for the day plan: times, copying a day forward, gaps and the current block. */
import { DayPlan, Habit, PlanBlock, SleepSchedule } from '../types/types';
import type { IconName } from '../components/Icon';
import { fromDateKey, newId, toDateKey } from './dates';
import { isDoneOn, isScheduled } from './habits';

export const DAY_MINUTES = 24 * 60;
/** Gaps shorter than this aren't worth showing as free time. */
export const MIN_GAP = 15;
export const DEFAULT_BLOCK_LENGTH = 30;

export const newBlockId = (): string => newId('b');

// ---- Time helpers -----------------------------------------------------------

const pad = (n: number) => String(n).padStart(2, '0');

/** 450 -> "07:30"; 1440 -> "24:00". */
export const formatMinutes = (minutes: number): string => `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;

/** "07:30" -> 450, or null if it isn't a valid time. */
export const parseMinutes = (hhmm: string): number | null => {
    const match = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
    if (!match) {
        return null;
    }
    const h = Number(match[1]);
    const m = Number(match[2]);
    return h <= 23 && m <= 59 ? h * 60 + m : null;
};

/** 45 -> "45 min", 60 -> "1 h", 90 -> "1 h 30 min". */
export const formatDuration = (minutes: number): string => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h === 0) {
        return `${m} min`;
    }
    return m ? `${h} h ${m} min` : `${h} h`;
};

export const minutesNow = (now: Date = new Date()): number => now.getHours() * 60 + now.getMinutes();

export const blockTimes = (block: Pick<PlanBlock, 'start' | 'end'>): string =>
    `${formatMinutes(block.start)}–${formatMinutes(block.end)}`;

/** Epoch millis of `minutes` after local midnight on the plan's day. */
export const timestampOf = (dateKey: string, minutes: number): number => {
    const date = fromDateKey(dateKey);
    date.setHours(0, 0, 0, 0);
    date.setMinutes(minutes);
    return date.getTime();
};

// ---- Blocks -----------------------------------------------------------------

export const sortBlocks = (blocks: PlanBlock[]): PlanBlock[] =>
    [...blocks].sort((a, b) => a.start - b.start || a.end - b.end || a.title.localeCompare(b.title));

/**
 * The blocks that apply on the plan's day, in time order. A block linked to a
 * habit only shows on days the habit is due (and disappears if the habit is
 * deleted), but it stays in the plan so it's back in place on the next due day.
 */
export const visibleBlocks = (plan: DayPlan, habits: Habit[]): PlanBlock[] => {
    const day = fromDateKey(plan.date);
    return sortBlocks(
        plan.blocks.filter(block => {
            if (!block.habitId) {
                return true;
            }
            const habit = habits.find(h => h.id === block.habitId);
            return !!habit && isScheduled(habit, day);
        }),
    );
};

export const isBlockDone = (block: PlanBlock, habits: Habit[], dateKey: string): boolean => {
    if (block.habitId) {
        const habit = habits.find(h => h.id === block.habitId);
        return !!habit && isDoneOn(habit, fromDateKey(dateKey));
    }
    return block.done === true;
};

/** Ids of the blocks that overlap another block. */
export const overlapping = (blocks: PlanBlock[]): Set<string> => {
    const ids = new Set<string>();
    const sorted = sortBlocks(blocks);
    for (let i = 0; i < sorted.length; i++) {
        for (let j = i + 1; j < sorted.length && sorted[j].start < sorted[i].end; j++) {
            ids.add(sorted[i].id);
            ids.add(sorted[j].id);
        }
    }
    return ids;
};

export interface Gap {
    start: number;
    end: number;
}

/** Free stretches of at least MIN_GAP minutes between blocks (not before the first or after the last). */
export const gapsBetween = (blocks: PlanBlock[]): Gap[] => {
    const gaps: Gap[] = [];
    let reach = -1;
    for (const block of sortBlocks(blocks)) {
        if (reach >= 0 && block.start - reach >= MIN_GAP) {
            gaps.push({ start: reach, end: block.start });
        }
        reach = Math.max(reach, block.end);
    }
    return gaps;
};

/**
 * Earliest start at or after `from` (rounded up to 5 minutes) where a block of
 * `length` fits without overlapping. Falls back to `from` if the day is full.
 */
export const findFreeSlot = (blocks: PlanBlock[], length: number, from: number): number => {
    let start = Math.ceil(from / 5) * 5;
    for (const block of sortBlocks(blocks)) {
        if (block.end <= start) {
            continue;
        }
        if (block.start >= start + length) {
            break;
        }
        start = block.end;
    }
    return start + length <= DAY_MINUTES ? start : Math.min(from, DAY_MINUTES - length);
};

export type PlanMoment =
    | { kind: 'empty' }
    | { kind: 'before'; next: PlanBlock }
    | { kind: 'during'; block: PlanBlock; next: PlanBlock | null }
    | { kind: 'free'; until: number; next: PlanBlock }
    | { kind: 'after' };

/** Where `now` (minutes after midnight) falls in the day's blocks. */
export const planMoment = (blocks: PlanBlock[], now: number): PlanMoment => {
    const sorted = sortBlocks(blocks);
    if (sorted.length === 0) {
        return { kind: 'empty' };
    }
    // When blocks overlap, the one that started last is the one "on" now.
    const current = sorted.filter(b => b.start <= now && now < b.end).pop();
    const next = sorted.find(b => b.start > now) ?? null;
    if (current) {
        return { kind: 'during', block: current, next };
    }
    if (!next) {
        return { kind: 'after' };
    }
    return now < sorted[0].start ? { kind: 'before', next } : { kind: 'free', until: next.start, next };
};

// ---- Making a day's plan ----------------------------------------------------

/**
 * The next day's plan, copied from `previous`: same blocks and times, nothing
 * checked off, one-off blocks left out.
 */
export const copyPlan = (previous: DayPlan, dateKey: string): DayPlan => ({
    date: dateKey,
    blocks: sortBlocks(previous.blocks.filter(b => !b.once).map(({ done: _done, ...block }) => block)),
});

/** Habits due on the plan's day that have no block yet, for the "add from habits" row. */
export const unplannedHabits = (plan: DayPlan, habits: Habit[]): Habit[] => {
    const day = fromDateKey(plan.date);
    const planned = new Set(plan.blocks.map(b => b.habitId).filter(Boolean));
    return habits.filter(h => isScheduled(h, day) && !planned.has(h.id));
};

/** A block for the habit: at its reminder time if that's free-ish, otherwise the next free slot. */
export const blockForHabit = (habit: Habit, blocks: PlanBlock[], from: number): PlanBlock => {
    const reminder = habit.reminder ? parseMinutes(habit.reminder) : null;
    const start = findFreeSlot(blocks, DEFAULT_BLOCK_LENGTH, reminder ?? from);
    return {
        id: newBlockId(),
        title: habit.title,
        icon: habit.icon,
        start,
        end: Math.min(DAY_MINUTES, start + DEFAULT_BLOCK_LENGTH),
        habitId: habit.id,
    };
};

interface Template {
    title: string;
    icon: IconName;
    /** Minutes after wake-up (positive) or before bedtime (negative). */
    offset: number;
    length: number;
    fromBed?: boolean;
}

const STARTER_DAY: Template[] = [
    { title: 'Morning routine', icon: 'Sunrise', offset: 0, length: 30 },
    { title: 'Breakfast', icon: 'Meal', offset: 30, length: 30 },
    { title: 'Deep work', icon: 'Work', offset: 120, length: 180 },
    { title: 'Lunch', icon: 'Meal', offset: 330, length: 45 },
    { title: 'Work', icon: 'Work', offset: 375, length: 225 },
    { title: 'Workout', icon: 'Dumbbell', offset: 630, length: 60 },
    { title: 'Dinner', icon: 'Meal', offset: 720, length: 45 },
    { title: 'Wind down', icon: 'Bed', offset: -45, length: 45, fromBed: true },
];

/**
 * A typical day to start from, fitted between wake-up and bedtime (from sleep
 * time), with each habit due that day slotted in. Everything is editable.
 */
export const starterPlan = (
    dateKey: string,
    habits: Habit[],
    sleep: Pick<SleepSchedule, 'wake' | 'bedtime'>,
): DayPlan => {
    const wake = parseMinutes(sleep.wake) ?? 7 * 60;
    let bed = parseMinutes(sleep.bedtime) ?? 23 * 60;
    if (bed <= wake + 12 * 60) {
        bed = DAY_MINUTES; // bedtime after midnight (or a very short day): end the plan at midnight
    }

    const blocks: PlanBlock[] = [];
    for (const t of STARTER_DAY) {
        const start = t.fromBed ? bed + t.offset : wake + t.offset;
        const end = Math.min(start + t.length, bed);
        if (start < wake || end - start < MIN_GAP || blocks.some(b => start < b.end && b.start < end)) {
            continue;
        }
        blocks.push({ id: newBlockId(), title: t.title, icon: t.icon, start, end });
    }

    const plan: DayPlan = { date: dateKey, blocks };
    for (const habit of unplannedHabits(plan, habits)) {
        // Linked habits replace the generic block of the same kind ("Workout").
        const twin = plan.blocks.find(b => !b.habitId && b.title.toLowerCase() === habit.title.toLowerCase());
        if (twin) {
            Object.assign(twin, { habitId: habit.id, icon: habit.icon });
            continue;
        }
        plan.blocks.push(blockForHabit(habit, plan.blocks, wake + 60));
    }
    return { date: dateKey, blocks: sortBlocks(plan.blocks) };
};

// ---- Motivation ---------------------------------------------------------------

const LINES = [
    'You planned this for a reason. Follow through.',
    'One block at a time.',
    'Small actions, done on time, add up.',
    'The plan only works if you do.',
    'Start now. Adjust later.',
    'Give this block your full attention. The rest can wait.',
    'Consistency beats intensity.',
    'Discipline is choosing what you want most over what you want now.',
    'Do the next right thing.',
    'You already decided. Now just begin.',
];

/** A short line to go with a reminder; stable for the same block on the same day. */
export const motivationFor = (seed: string): string => {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
        hash = (hash * 31 + seed.charCodeAt(i)) % 1_000_003;
    }
    return LINES[Math.abs(hash) % LINES.length];
};

export const todayKey = (): string => toDateKey(new Date());
