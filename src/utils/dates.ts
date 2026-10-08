/**
 * Local-calendar date helpers. Days are stored as "YYYY-MM-DD" keys in the
 * phone's time zone, so 23:59 and 00:01 land on different days as expected.
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

/** Monday 00:00 of the week containing `date`. */
export const startOfWeek = (date: Date): Date => {
    const monday = addDays(date, -weekdayIndex(date));
    monday.setHours(0, 0, 0, 0);
    return monday;
};

/** "Oct 8" (or "Oct 8, 2025" when not this year). */
export const shortDate = (date: Date, today: Date = new Date()): string =>
    date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        ...(date.getFullYear() !== today.getFullYear() ? { year: 'numeric' } : {}),
    });

/** Unique-enough id for locally stored records. */
export const newId = (prefix: string): string =>
    `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
