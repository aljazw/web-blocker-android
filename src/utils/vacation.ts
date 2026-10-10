import { Vacation } from '../types/types';
import { fromDateKey, shortDate, toDateKey } from './dates';

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

export type VacationPhase = 'upcoming' | 'active' | 'over';

/** Both keys are real dates and the range runs forwards. */
export const isValidVacation = (v: Vacation): boolean =>
    DATE_KEY.test(v.start) &&
    DATE_KEY.test(v.end) &&
    toDateKey(fromDateKey(v.start)) === v.start &&
    toDateKey(fromDateKey(v.end)) === v.end &&
    v.start <= v.end;

/** Date keys sort like dates, so plain string comparison is enough. */
export const vacationPhase = (v: Vacation, now: Date = new Date()): VacationPhase => {
    const today = toDateKey(now);
    if (today < v.start) {
        return 'upcoming';
    }
    return today <= v.end ? 'active' : 'over';
};

export const isOnVacation = (v: Vacation | null, now: Date = new Date()): boolean =>
    v !== null && vacationPhase(v, now) === 'active';

/** Number of days in the range, both ends included. */
export const vacationDays = (v: Vacation): number =>
    Math.round((fromDateKey(v.end).getTime() - fromDateKey(v.start).getTime()) / 86_400_000) + 1;

/** "Oct 12 – Oct 20", or just "Oct 12" for a single day. */
export const vacationRangeLabel = (v: Vacation, now: Date = new Date()): string =>
    v.start === v.end
        ? shortDate(fromDateKey(v.start), now)
        : `${shortDate(fromDateKey(v.start), now)} – ${shortDate(fromDateKey(v.end), now)}`;
