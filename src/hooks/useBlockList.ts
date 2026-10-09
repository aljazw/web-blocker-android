import { useCallback, useMemo } from 'react';
import { BlockEntry, BlockedAppData, BlockedWebsitesData } from '../types/types';
import {
    STORAGE_KEYS,
    deleteBlockedApp,
    deleteBlockedWebsite,
    getBlockedApps,
    getBlockedWebsites,
    hideBlockedApp,
    hideBlockedWebsite,
} from '../storage';
import { useFocusData } from './useFocusData';

const load = () => Promise.all([getBlockedWebsites(), getBlockedApps()]);
const EMPTY: [BlockedWebsitesData[], BlockedAppData[]] = [[], []];
const WATCH = [STORAGE_KEYS.websites, STORAGE_KEYS.apps];

/** The combined block list (websites + apps), current with changes from any screen. */
export const useBlockList = () => {
    const { data, loaded, failed: loadFailed, reload } = useFocusData(load, EMPTY, { watch: WATCH });
    const [sites, apps] = data;

    const entries = useMemo<BlockEntry[]>(
        () => [
            ...sites.map(site => ({ ...site, kind: 'site' as const, key: site.websiteUrl, label: site.websiteUrl })),
            ...apps.map(app => ({ ...app, kind: 'app' as const, key: app.packageName, label: app.appName })),
        ],
        [sites, apps],
    );

    /** Removes the block. Resolves false if saving failed. */
    const remove = useCallback(
        (entry: BlockEntry) => (entry.kind === 'app' ? deleteBlockedApp(entry.key) : deleteBlockedWebsite(entry.key)),
        [],
    );

    /** Hides the block from the list (it keeps blocking). Resolves false if saving failed. */
    const hide = useCallback(
        (entry: BlockEntry) => (entry.kind === 'app' ? hideBlockedApp(entry.key) : hideBlockedWebsite(entry.key)),
        [],
    );

    return { entries, loaded, loadFailed, reload, remove, hide };
};
