import { NativeModules } from 'react-native';
import { Platform } from 'react-native';
import { logger } from './logger';

const { AccessibilityStatus, IntentLauncher } = NativeModules;

export async function checkAccessibilityEnabled(): Promise<boolean> {
    try {
        const result = await AccessibilityStatus.isAccessibilityServiceEnabled();
        return result === true;
    } catch (error) {
        return false;
    }
}

export function openAccessibilitySettings() {
    if (Platform.OS !== 'android') {
        return;
    }
    try {
        IntentLauncher.startActivity('com.gaman.OpenAccessibilityActivity');
    } catch (error) {
        logger.warn('Could not open Accessibility settings', error);
    }
}
