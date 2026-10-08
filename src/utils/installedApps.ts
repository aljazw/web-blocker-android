import { NativeModules } from 'react-native';

const { InstalledApps } = NativeModules;

export interface InstalledApp {
    packageName: string;
    label: string;
}

/** Apps the user can launch, sorted by name (SiteLock itself excluded). */
export const getLaunchableApps = async (): Promise<InstalledApp[]> => {
    try {
        return (await InstalledApps.getLaunchableApps()) ?? [];
    } catch {
        return [];
    }
};

// Icons are fetched one by one and cached for the app's lifetime.
const iconCache = new Map<string, Promise<string | null>>();

/** data: URI of the app's icon, or null if it isn't installed. */
export const getAppIcon = (packageName: string): Promise<string | null> => {
    let icon = iconCache.get(packageName);
    if (!icon) {
        icon = InstalledApps.getAppIcon(packageName).catch(() => null) as Promise<string | null>;
        iconCache.set(packageName, icon);
    }
    return icon;
};
