import { SleepSchedule } from '../types/types';
import { DEFAULT_SLEEP_SCHEDULE, isValidTime } from '../utils/sleep';
import { KEYS, readObject, readRaw, serialized, writeJson, writeRaw } from './core';

const toSleepSchedule = (v: any): SleepSchedule => {
    const d = DEFAULT_SLEEP_SCHEDULE;
    return {
        enabled: v.enabled === true,
        bedtime: typeof v.bedtime === 'string' && isValidTime(v.bedtime) ? v.bedtime : d.bedtime,
        wake: typeof v.wake === 'string' && isValidTime(v.wake) ? v.wake : d.wake,
    };
};

export const getSleepSchedule = (): Promise<SleepSchedule> => readObject(KEYS.sleepSchedule, toSleepSchedule);

/**
 * Saves the schedule and clears any "turned off tonight" pause, so a schedule
 * saved during the night takes effect right away.
 */
export const setSleepSchedule = (schedule: SleepSchedule): Promise<boolean> =>
    serialized(async () => {
        try {
            await writeRaw(KEYS.sleepDismissedUntil, '0');
            return await writeJson(KEYS.sleepSchedule, schedule);
        } catch {
            return false;
        }
    });

/** Epoch millis until which sleep time is turned off (set by the native sleep page), or 0. */
export const getSleepDismissedUntil = async (): Promise<number> => {
    const value = Number(await readRaw(KEYS.sleepDismissedUntil));
    return Number.isFinite(value) ? value : 0;
};
