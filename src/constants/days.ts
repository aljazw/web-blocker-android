/** Seven Monday-first flags: which weekdays something applies to. */
export type WeekFlags = boolean[];

export const EVERY_DAY: WeekFlags = [true, true, true, true, true, true, true];
export const WEEKDAYS: WeekFlags = [true, true, true, true, true, false, false];
export const WEEKENDS: WeekFlags = [false, false, false, false, false, true, true];

export const DAY_PRESETS: { label: string; days: WeekFlags }[] = [
    { label: 'Every day', days: EVERY_DAY },
    { label: 'Weekdays', days: WEEKDAYS },
    { label: 'Weekends', days: WEEKENDS },
];

export const sameDays = (a: WeekFlags, b: WeekFlags) => a.length === b.length && a.every((v, i) => v === b[i]);
