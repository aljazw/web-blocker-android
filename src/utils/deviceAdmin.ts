import { NativeModules } from 'react-native';

const { DeviceAdminModule } = NativeModules;

/** Whether SiteLock is a device admin (uninstall prevention). False if it can't be checked. */
export async function checkAdmin(): Promise<boolean> {
    try {
        return (await DeviceAdminModule.isAdminEnabled()) === true;
    } catch {
        return false;
    }
}

/**
 * Opens the system flow to turn device admin on or off.
 * Rejects if the system screen can't be opened, so the caller can show an error.
 */
export function toggleDeviceAdmin(): Promise<boolean> {
    return DeviceAdminModule.toggleAdmin();
}
