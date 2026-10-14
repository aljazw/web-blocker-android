import { BlockedAppData, BlockedWebsitesData } from '../types/types';
import { KEYS, isString, readList, updateList } from './core';

/** Keeps only well-formed entries; fills in `visible` for old data that lacked it. */
const toWebsite = (v: any): BlockedWebsitesData | null =>
    v && isString(v.websiteUrl) && typeof v.days === 'string' && typeof v.time === 'string'
        ? { websiteUrl: v.websiteUrl, days: v.days, time: v.time, visible: v.visible !== false }
        : null;

const toApp = (v: any): BlockedAppData | null =>
    v && isString(v.packageName) && typeof v.days === 'string' && typeof v.time === 'string'
        ? {
              packageName: v.packageName,
              appName: isString(v.appName) ? v.appName : v.packageName,
              days: v.days,
              time: v.time,
              visible: v.visible !== false,
          }
        : null;

/** The same operations for blocked websites and blocked apps, keyed by URL or package name. */
const blockStore = <T extends { visible: boolean }>(
    key: string,
    toItem: (v: any) => T | null,
    idOf: (t: T) => string,
) => ({
    get: async (): Promise<T[]> => {
        try {
            return await readList(key, toItem);
        } catch {
            throw new Error(`Failed to read ${key}`);
        }
    },
    /** Adding one that's already on the list is a no-op that still succeeds. */
    add: (entry: T): Promise<boolean> =>
        updateList(key, toItem, list => (list.some(x => idOf(x) === idOf(entry)) ? list : [...list, entry])),
    remove: (id: string): Promise<boolean> => updateList(key, toItem, list => list.filter(x => idOf(x) !== id)),
    /**
     * Adds every well-formed entry not already on the list (backup import).
     * Existing entries are never removed or changed, so an import can't lift a block.
     */
    merge: (incoming: unknown[]): Promise<boolean> =>
        updateList(key, toItem, list => {
            const have = new Set(list.map(idOf));
            const added: T[] = [];
            for (const item of incoming.map(toItem)) {
                if (item && !have.has(idOf(item))) {
                    have.add(idOf(item));
                    added.push(item);
                }
            }
            return [...list, ...added];
        }),
    /** Hidden entries keep blocking but no longer show in the list. */
    hide: (id: string): Promise<boolean> =>
        updateList(key, toItem, list => list.map(x => (idOf(x) === id ? { ...x, visible: false } : x))),
});

const websites = blockStore(KEYS.websites, toWebsite, site => site.websiteUrl);
const apps = blockStore(KEYS.apps, toApp, app => app.packageName);

export const getBlockedWebsites = websites.get;
export const addBlockedWebsite = websites.add;
export const deleteBlockedWebsite = websites.remove;
export const hideBlockedWebsite = websites.hide;
export const mergeBlockedWebsites = websites.merge;

export const getBlockedApps = apps.get;
export const addBlockedApp = apps.add;
export const deleteBlockedApp = apps.remove;
export const hideBlockedApp = apps.hide;
export const mergeBlockedApps = apps.merge;
