import { useEffect, useState } from 'react';
import notifee from '@notifee/react-native';
import { hasUserSeenWelcome, isNotificationScheduled, setNotificationScheduled } from '../utils/storage';
import { checkAccessibilityEnabled } from '../utils/accessibility';
import { scheduleDailyNotification } from '../utils/notificationService';
import { logger } from '../utils/logger';

export type AppStatus = 'loading' | 'welcome' | 'main';

/** Keeps the daily "enable Accessibility" reminder in sync with the service state. */
const syncAccessibilityReminder = async () => {
    await notifee.createChannel({ id: 'default', name: 'Default Channel' });

    const [alreadyScheduled, accessibilityEnabled] = await Promise.all([
        isNotificationScheduled(),
        checkAccessibilityEnabled(),
    ]);

    if (!accessibilityEnabled && !alreadyScheduled) {
        await scheduleDailyNotification();
        await setNotificationScheduled(true);
    } else if (accessibilityEnabled && alreadyScheduled) {
        await notifee.cancelTriggerNotification('accessibility-reminder');
        await setNotificationScheduled(false);
    }
};

/**
 * Decides the first screen. Startup can never get stuck on a blank screen:
 * the reminder sync is best-effort, and if reading the welcome flag fails we
 * fall back to the main app.
 */
export const useAppInitializer = () => {
    const [status, setStatus] = useState<AppStatus>('loading');

    useEffect(() => {
        let cancelled = false;

        const initialize = async () => {
            syncAccessibilityReminder().catch(error => logger.warn('Reminder sync failed', error));

            let showWelcome = false;
            try {
                showWelcome = !(await hasUserSeenWelcome());
            } catch (error) {
                logger.warn('Could not read welcome flag', error);
            }
            if (!cancelled) {
                setStatus(showWelcome ? 'welcome' : 'main');
            }
        };

        initialize();
        return () => {
            cancelled = true;
        };
    }, []);

    return { status, setStatus };
};
