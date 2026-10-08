export const FULL_WEEK = 'Full Week';
export const ALL_DAY = 'All Day Long';
export const WEEK_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const TIME_RANGE = /^(\d{2}):(\d{2})\s*-\s*(\d{2}):(\d{2})$/;

const toMinutes = (h: string, m: string) => parseInt(h, 10) * 60 + parseInt(m, 10);

/**
 * Mirrors BlockAccessibilityService: the site is blocked on its days, and within
 * its time range (start inclusive, end exclusive, may wrap past midnight).
 */
export const isBlockActiveNow = (site: { days: string; time: string }, now: Date = new Date()): boolean => {
    // JS getDay(): 0 = Sunday. Map to Mon..Sun labels.
    const today = WEEK_DAYS[(now.getDay() + 6) % 7].toLowerCase();
    const days =
        site.days === FULL_WEEK
            ? WEEK_DAYS.map(d => d.toLowerCase())
            : site.days.split(',').map(d => d.trim().replace(/'/g, '').toLowerCase());
    if (!days.includes(today)) {
        return false;
    }

    const match = site.time ? TIME_RANGE.exec(site.time) : null;
    if (!match) {
        return true; // "All Day Long" (or anything unparseable) blocks all day
    }

    const minute = now.getHours() * 60 + now.getMinutes();
    const start = toMinutes(match[1], match[2]);
    const end = toMinutes(match[3], match[4]);
    return start <= end ? minute >= start && minute < end : minute >= start || minute < end;
};

/** Short, human label for a site's days, e.g. "Every day", "Weekdays", "Mon, Wed". */
export const describeDays = (days: string): string => {
    if (days === FULL_WEEK) {
        return 'Every day';
    }
    const list = days.split(',').map(d => d.trim());
    if (list.join(',') === 'Mon,Tue,Wed,Thu,Fri') {
        return 'Weekdays';
    }
    if (list.join(',') === 'Sat,Sun') {
        return 'Weekends';
    }
    return list.join(', ');
};

export const describeTime = (time: string): string => (!time || time === ALL_DAY ? 'All day' : time);

/** One-line schedule summary, e.g. "Always", "Weekdays · 09:00 - 17:00". */
export const describeSchedule = (days: string, time: string): string => {
    const allDay = !time || time === ALL_DAY;
    if (days === FULL_WEEK && allDay) {
        return 'Always';
    }
    return `${describeDays(days)} · ${describeTime(time)}`;
};

/** Hour/minute text fields of a custom block window, as typed. */
export interface TimeWindowInput {
    startHour: string;
    startMinutes: string;
    endHour: string;
    endMinutes: string;
}

export interface ScheduleResult {
    /** Stored days string: FULL_WEEK or "Mon, Tue, …". */
    days: string;
    /** Stored time string: ALL_DAY or "HH:MM - HH:MM". */
    time: string;
    /** Why the schedule can't be saved yet, or null if it can. */
    problem: string | null;
    /** The window wraps past midnight (e.g. 22:00 - 07:00). */
    overnight: boolean;
}

const pad2 = (v: string) => v.padStart(2, '0');

/**
 * Turns the schedule form (seven Monday-first day flags, plus an optional
 * custom time window) into the stored strings, and validates it.
 */
export const buildSchedule = (days: boolean[], window: TimeWindowInput | null): ScheduleResult => {
    const daysText = days.every(Boolean) ? FULL_WEEK : WEEK_DAYS.filter((_, i) => days[i]).join(', ');
    const fail = (problem: string, time = ALL_DAY): ScheduleResult => ({
        days: daysText,
        time,
        problem,
        overnight: false,
    });

    if (!days.some(Boolean)) {
        return fail('Pick at least one day.');
    }
    if (!window) {
        return { days: daysText, time: ALL_DAY, problem: null, overnight: false };
    }

    const parts = [window.startHour, window.startMinutes, window.endHour, window.endMinutes];
    if (parts.some(v => v.length === 0)) {
        return fail('Fill in both start and end times, or choose “All day”.');
    }
    const [sh, sm, eh, em] = parts.map(v => parseInt(v, 10));
    if ([sh, sm, eh, em].some(Number.isNaN) || sh > 23 || eh > 23 || sm > 59 || em > 59) {
        return fail('That time isn’t valid.');
    }
    const start = sh * 60 + sm;
    const end = eh * 60 + em;
    if (start === end) {
        return fail('Start and end time can’t be the same.');
    }
    const time = `${pad2(window.startHour)}:${pad2(window.startMinutes)} - ${pad2(window.endHour)}:${pad2(
        window.endMinutes,
    )}`;
    return { days: daysText, time, problem: null, overnight: end < start };
};
