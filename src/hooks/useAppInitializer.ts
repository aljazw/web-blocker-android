import { useEffect, useState } from 'react';
import { hasUserSeenWelcome, isNotificationScheduled, setNotificationScheduled } from '../utils/storage';
import notifee from '@notifee/react-native';
import { checkAccessibilityEnabled } from '../utils/accessibility';
import { scheduleDailyNotification } from '../utils/notificationService';

export const useAppInitializer = () => {
    const [status, setStatus] = useState<'loading' | 'welcome' | 'main'>('loading');

    useEffect(() => {
        const initialize = async () => {
            const hasSeenWelcome = await hasUserSeenWelcome();
            const showWelcome = !hasSeenWelcome;

            await notifee.createChannel({ id: 'default', name: 'Default Channel' });

            const alreadyScheduled = await isNotificationScheduled();
            const accessibilityEnabled = await checkAccessibilityEnabled();

            if (!accessibilityEnabled) {
                if (alreadyScheduled === false) {
                    await scheduleDailyNotification();
                    await setNotificationScheduled(true);
                } else {
                    await setNotificationScheduled(false);
                }
            } else if (alreadyScheduled === true) {
                await notifee.cancelTriggerNotification('accessibility-reminder');
                await setNotificationScheduled(false);
            }

            setStatus(showWelcome ? 'welcome' : 'main');
        };

        initialize();
    }, []);

    return { status, setStatus };
};
