import { NativeModules } from 'react-native';

const { InstalledApps } = NativeModules;

export interface InstalledApp {
    packageName: string;
    label: string;
}

let appsCache: Promise<InstalledApp[]> | null = null;

/**
 * Apps the user can launch, sorted by name (Gaman itself excluded). Cached for
 * the session: listing every app is slow, and installs during a session are rare.
 */
export const getLaunchableApps = (): Promise<InstalledApp[]> => {
    if (!appsCache) {
        appsCache = (async () => {
            try {
                return ((await InstalledApps.getLaunchableApps()) ?? []) as InstalledApp[];
            } catch {
                appsCache = null; // try again next time
                return [];
            }
        })();
    }
    return appsCache;
};

// Icons are fetched one by one and cached for the app's lifetime.
const iconCache = new Map<string, Promise<string | null>>();
const loadedIcons = new Map<string, string | null>();

/** data: URI of the app's icon, or null if it isn't installed. */
export const getAppIcon = (packageName: string): Promise<string | null> => {
    let icon = iconCache.get(packageName);
    if (!icon) {
        icon = (InstalledApps.getAppIcon(packageName) as Promise<string | null>)
            .catch(() => null)
            .then(uri => {
                loadedIcons.set(packageName, uri);
                return uri;
            });
        iconCache.set(packageName, icon);
    }
    return icon;
};

/** The icon if it was already loaded, so a re-mounted row can show it without a placeholder flash. */
export const cachedAppIcon = (packageName: string): string | null | undefined => loadedIcons.get(packageName);
