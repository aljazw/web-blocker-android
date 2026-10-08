import { Habit } from '../types/types';

/**
 * Pure date & streak logic for habits. Dates are LOCAL calendar days stored as
 * "YYYY-MM-DD" keys, so a check-in at 23:59 and one at 00:01 land on different
 * days the way the user expects, regardless of time zone.
 */

const pad = (n: number) => String(n).padStart(2, '0');

export const toDateKey = (date: Date): string =>
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

/** Parses a key at local noon, so adding days never trips over DST changes. */
export const fromDateKey = (key: string): Date => {
    const [y, m, d] = key.split('-').map(Number);
    return new Date(y, m - 1, d, 12);
};

export const addDays = (date: Date, days: number): Date => {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    return next;
};

/** 0 = Monday … 6 = Sunday. */
export const weekdayIndex = (date: Date): number => (date.getDay() + 6) % 7;

export const isScheduled = (habit: Habit, date: Date): boolean => habit.days[weekdayIndex(date)] === true;

export const isDoneOn = (habit: Habit, date: Date): boolean => habit.completions.includes(toDateKey(date));

/** Upper bound on how far back we walk, so corrupt data can never loop for long. */
const MAX_LOOKBACK_DAYS = 3660;

/**
 * Consecutive due days completed, counting back from today. Days the habit
 * isn't due are skipped. Today only counts once it's done — an unfinished
 * today is "still pending", so it doesn't break the streak.
 */
export const currentStreak = (habit: Habit, today: Date = new Date()): number => {
    if (!habit.days.some(Boolean)) return 0;
    const done = new Set(habit.completions);
    const start = habit.createdAt;
    let day = today;
    let streak = 0;

    if (isScheduled(habit, day) && !done.has(toDateKey(day))) {
        day = addDays(day, -1); // today is still pending
    }
    for (let i = 0; i < MAX_LOOKBACK_DAYS && toDateKey(day) >= start; i++, day = addDays(day, -1)) {
        if (!isScheduled(habit, day)) continue;
        if (!done.has(toDateKey(day))) break;
        streak++;
    }
    return streak;
};

/** Longest run of completed due days since the habit was created. */
export const bestStreak = (habit: Habit, today: Date = new Date()): number => {
    if (!habit.days.some(Boolean)) return 0;
    const done = new Set(habit.completions);
    const todayKey = toDateKey(today);
    let day = fromDateKey(habit.createdAt);
    let run = 0;
    let best = 0;

    for (let i = 0; i < MAX_LOOKBACK_DAYS && toDateKey(day) <= todayKey; i++, day = addDays(day, 1)) {
        if (!isScheduled(habit, day)) continue;
        const key = toDateKey(day);
        if (done.has(key)) {
            run++;
            best = Math.max(best, run);
        } else if (key !== todayKey) {
            run = 0; // a missed past day ends the run; today is still pending
        }
    }
    return best;
};

export interface DayStatus {
    key: string;
    label: string;
    scheduled: boolean;
    done: boolean;
    isToday: boolean;
}

/** The last `count` days, oldest first, for the little history dots. */
export const recentDays = (habit: Habit, count = 7, today: Date = new Date()): DayStatus[] =>
    Array.from({ length: count }, (_, i) => {
        const day = addDays(today, i - (count - 1));
        const key = toDateKey(day);
        return {
            key,
            label: 'MTWTFSS'[weekdayIndex(day)],
            scheduled: isScheduled(habit, day) && key >= habit.createdAt,
            done: habit.completions.includes(key),
            isToday: i === count - 1,
        };
    });

/**
 * Share of due check-ins completed over the last `days` days (0–1), or null
 * if nothing was due. An unfinished today isn't counted against you yet.
 */
export const completionRate = (habits: Habit[], days = 7, today: Date = new Date()): number | null => {
    let due = 0;
    let done = 0;
    for (const habit of habits) {
        for (const day of recentDays(habit, days, today)) {
            if (!day.scheduled) continue;
            if (day.done) {
                due++;
                done++;
            } else if (!day.isToday) {
                due++;
            }
        }
    }
    return due === 0 ? null : done / due;
};

export const STREAK_MILESTONES = [3, 7, 14, 21, 30, 50, 75, 100, 150, 200, 365];

/** The milestone hit exactly at this streak length, if any. */
export const milestoneFor = (streak: number): number | null => (STREAK_MILESTONES.includes(streak) ? streak : null);

/** Returns the habit with today's check-in toggled. */
export const toggleCompletion = (habit: Habit, date: Date = new Date()): Habit => {
    const key = toDateKey(date);
    const completions = habit.completions.includes(key)
        ? habit.completions.filter(k => k !== key)
        : [...habit.completions, key].sort();
    return { ...habit, completions };
};

export const newHabitId = (): string => `h_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

const QUOTES = [
    'Small steps every day add up to big results.',
    'You don’t have to be great to start, but you have to start to be great.',
    'Discipline is choosing what you want most over what you want now.',
    'Success is the sum of small efforts, repeated day in and day out.',
    'Motivation gets you going. Habit keeps you going.',
    'The secret of getting ahead is getting started.',
    'Don’t break the chain.',
    'Progress, not perfection.',
    'Every check-in is a vote for the person you want to become.',
    'One day or day one. You decide.',
];

/** Same quote all day, a new one tomorrow. */
export const quoteOfTheDay = (today: Date = new Date()): string => {
    const key = toDateKey(today).replace(/-/g, '');
    return QUOTES[Number(key) % QUOTES.length];
};
