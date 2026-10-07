import { NativeModules } from 'react-native';

const { OverlayPermission } = NativeModules;

/** Whether "Display over other apps" is granted (needed for the disable-warning). */
export async function canDrawOverlays(): Promise<boolean> {
    try {
        return await OverlayPermission.canDrawOverlays();
    } catch {
        return false;
    }
}

/** Opens the system screen to grant the permission. Re-check after returning. */
export async function requestOverlay(): Promise<void> {
    try {
        await OverlayPermission.requestOverlayPermission();
    } catch {
        // ignore — user can grant manually
    }
}
