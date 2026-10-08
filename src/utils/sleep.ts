import { SleepSchedule } from '../types/types';

export const DEFAULT_SLEEP_SCHEDULE: SleepSchedule = { enabled: false, bedtime: '23:00', wake: '07:00' };

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export const isValidTime = (value: string) => TIME.test(value);

const minutesOf = (hhmm: string) => {
    const [h, m] = hhmm.split(':').map(Number);
    return h * 60 + m;
};

/**
 * Mirrors SleepSchedule.isActive on the native side: bedtime inclusive, wake
 * time exclusive, wrapping past midnight. Ignores a "turned off tonight" pause.
 */
export const isSleepWindow = (schedule: SleepSchedule, now = new Date()) => {
    if (!schedule.enabled || schedule.bedtime === schedule.wake) {
        return false;
    }
    const bed = minutesOf(schedule.bedtime);
    const wake = minutesOf(schedule.wake);
    const t = now.getHours() * 60 + now.getMinutes();
    return bed < wake ? t >= bed && t < wake : t >= bed || t < wake;
};

/** Length of the night, e.g. "8 h" or "7 h 30 min". */
export const sleepDuration = (schedule: Pick<SleepSchedule, 'bedtime' | 'wake'>) => {
    const total = (minutesOf(schedule.wake) - minutesOf(schedule.bedtime) + 24 * 60) % (24 * 60);
    const h = Math.floor(total / 60);
    const m = total % 60;
    return m ? `${h} h ${m} min` : `${h} h`;
};
