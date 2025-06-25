import notifee, { TimestampTrigger, TriggerType, AndroidBigTextStyle, AndroidStyle, AndroidLaunchActivityFlag } from '@notifee/react-native';
import { notificationText } from '../assets/data/textContent';


export async function scheduleDailyNotification() {

    const text = notificationText;

    const bigTextStyle: AndroidBigTextStyle = {
        type: AndroidStyle.BIGTEXT,
        text: text
    };

    // Schedule daily notification starting at 9:00 AM next time
    const date = new Date(Date.now());
    date.setHours(10);
    date.setMinutes(0);
    date.setSeconds(20);

    // If 9 AM has already passed today, schedule for tomorrow
    if (date.getTime() <= Date.now()) {
        date.setDate(date.getDate() + 1);
    }

    const trigger: TimestampTrigger = {
        type: TriggerType.TIMESTAMP,
        timestamp: date.getTime(),
        repeatFrequency: 1, // daily
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
        trigger
    );
}
