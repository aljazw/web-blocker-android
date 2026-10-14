import notifee, { AuthorizationStatus } from '@notifee/react-native';
import { logger } from './logger';

/** Asks for notification permission (Android 13+). Resolves whether reminders can be shown. */
export const ensureReminderPermission = async (): Promise<boolean> => {
    try {
        // Asking again when already allowed can stall on some devices; check first.
        const current = await notifee.getNotificationSettings();
        if (current.authorizationStatus === AuthorizationStatus.AUTHORIZED) {
            return true;
        }
        const settings = await notifee.requestPermission();
        return settings.authorizationStatus === AuthorizationStatus.AUTHORIZED;
    } catch (error) {
        logger.warn('Notification permission request failed', error);
        return false;
    }
};
