import { BlockedWebsitesData } from '../types/types';

export const FULL_WEEK = 'Full Week';
export const ALL_DAY = 'All Day Long';
export const WEEK_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const TIME_RANGE = /^(\d{2}):(\d{2})\s*-\s*(\d{2}):(\d{2})$/;

const toMinutes = (h: string, m: string) => parseInt(h, 10) * 60 + parseInt(m, 10);

/**
 * Mirrors BlockAccessibilityService: the site is blocked on its days, and within
 * its time range (start inclusive, end exclusive, may wrap past midnight).
 */
export const isBlockActiveNow = (site: BlockedWebsitesData, now: Date = new Date()): boolean => {
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
