import { Vacation } from '../types/types';
import { isValidVacation } from '../utils/vacation';
import { KEYS, parseJson, readParsed, writeJson } from './core';

const toVacation = (raw: string | null): Vacation | null => {
    const v = parseJson(raw) as Partial<Vacation> | null;
    if (!v || typeof v !== 'object' || typeof v.start !== 'string' || typeof v.end !== 'string') {
        return null;
    }
    const vacation = { start: v.start, end: v.end };
    return isValidVacation(vacation) ? vacation : null;
};

/** The planned or current vacation, or null. */
export const getVacation = (): Promise<Vacation | null> => readParsed(KEYS.vacation, toVacation);

/** Saves a vacation, or removes it with null. Resolves false on failure. */
export const setVacation = async (vacation: Vacation | null): Promise<boolean> => {
    try {
        return await writeJson(KEYS.vacation, vacation);
    } catch {
        return false;
    }
};
