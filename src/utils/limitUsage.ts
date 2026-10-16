/**
 * Time used today on blocks with a daily limit. BlockAccessibilityService
 * counts it (UsageLimits.kt); this only reads it, for the block list.
 */
import { BlockEntry } from '../types/types';
import { KEYS, readRaw } from '../storage/core';
import { toDateKey } from './dates';
import { logger } from './logger';

/** Matches UsageLimits.appKey / siteKey. */
export const usageKeyOf = (entry: Pick<BlockEntry, 'kind' | 'key'>): string =>
    `${entry.kind === 'app' ? 'app' : 'site'}:${entry.key}`;

/** Whole minutes used today, by usage key. Empty when nothing was used (or on a read error). */
export const parseLimitUsage = (raw: string | null, today: Date = new Date()): Record<string, number> => {
    try {
        const data = raw ? JSON.parse(raw) : null;
        if (!data || data.day !== toDateKey(today) || typeof data.used !== 'object' || !data.used) {
            return {};
        }
        const result: Record<string, number> = {};
        for (const [key, ms] of Object.entries(data.used)) {
            if (typeof ms === 'number' && ms > 0) {
                result[key] = Math.floor(ms / 60_000);
            }
        }
        return result;
    } catch (error) {
        logger.warn('Could not read limit usage', error);
        return {};
    }
};

export const getLimitUsage = async (): Promise<Record<string, number>> => {
    try {
        return parseLimitUsage(await readRaw(KEYS.limitUsage));
    } catch (error) {
        logger.warn('Could not read limit usage', error);
        return {};
    }
};
