import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { BlockEntry } from '../types/types';
import {
    deleteBlockedApp,
    deleteBlockedWebsite,
    getBlockedApps,
    getBlockedWebsites,
    hideBlockedApp,
    hideBlockedWebsite,
} from '../utils/storage';

/**
 * The combined block list (websites + apps). Reloads every time the screen
 * gains focus, so changes made on other screens always show up.
 */
export const useBlockList = () => {
    const [entries, setEntries] = useState<BlockEntry[]>([]);
    const [loadFailed, setLoadFailed] = useState(false);

    const reload = useCallback(async () => {
        try {
            const [sites, apps] = await Promise.all([getBlockedWebsites(), getBlockedApps()]);
            setEntries([
                ...sites.map(site => ({
                    ...site,
                    kind: 'site' as const,
                    key: site.websiteUrl,
                    label: site.websiteUrl,
                })),
                ...apps.map(app => ({ ...app, kind: 'app' as const, key: app.packageName, label: app.appName })),
            ]);
            setLoadFailed(false);
        } catch {
            setLoadFailed(true);
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
            reload();
        }, [reload]),
    );

    /** Removes the block. Resolves false if saving failed. */
    const remove = useCallback(
        async (entry: BlockEntry) => {
            const ok = entry.kind === 'app' ? await deleteBlockedApp(entry.key) : await deleteBlockedWebsite(entry.key);
            await reload();
            return ok;
        },
        [reload],
    );

    /** Hides the block from the list (it keeps blocking). Resolves false if saving failed. */
    const hide = useCallback(
        async (entry: BlockEntry) => {
            const ok = entry.kind === 'app' ? await hideBlockedApp(entry.key) : await hideBlockedWebsite(entry.key);
            await reload();
            return ok;
        },
        [reload],
    );

    return { entries, loadFailed, reload, remove, hide };
};
