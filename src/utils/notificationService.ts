import notifee, {
    TimestampTrigger,
    TriggerType,
    AndroidBigTextStyle,
    AndroidStyle,
    AndroidLaunchActivityFlag,
} from '@notifee/react-native';
import { ACCESSIBILITY_NOTIFICATION_TEXT } from '../constants/strings';
import { checkAccessibilityEnabled } from './accessibility';


export async function scheduleDailyNotification() {
    // 1. Check if accessibility is ALREADY enabled
    const isEnabled = await checkAccessibilityEnabled();

    // 2. If already enabled, cancel any existing reminder and stop
    if (isEnabled) {
        await notifee.cancelNotification('accessibility-reminder');
        return;
    }

    // 3. Otherwise, schedule the trigger notification
    const text = ACCESSIBILITY_NOTIFICATION_TEXT;

    const bigTextStyle: AndroidBigTextStyle = {
        type: AndroidStyle.BIGTEXT,
        text: text,
    };

    const date = new Date(Date.now());
    date.setHours(10);
    date.setMinutes(0);
    date.setSeconds(20);

    if (date.getTime() <= Date.now()) {
        date.setDate(date.getDate() + 1);
    }

    const trigger: TimestampTrigger = {
        type: TriggerType.TIMESTAMP,
        timestamp: date.getTime(),
        repeatFrequency: 1, // RepeatFrequency.DAILY
    };

    await notifee.createTriggerNotification(
        {
            id: 'accessibility-reminder',
            title: 'Accessibility Service Needed',
            android: {
                channelId: 'default',
                showTimestamp: true,
                smallIcon: 'ic_stat_sitelock',
                largeIcon: 'ic_stat_sitelock',
                style: bigTextStyle,
                pressAction: {
                    id: 'default',
                    launchActivity: 'com.sitelock.OpenAccessibilityActivity',
                    launchActivityFlags: [AndroidLaunchActivityFlag.NEW_TASK],
                },
            },
        },
        trigger,
    );
}
