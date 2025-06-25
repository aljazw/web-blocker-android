import notifee, { TimestampTrigger, TriggerType, AndroidBigTextStyle, AndroidStyle, AndroidLaunchActivityFlag } from '@notifee/react-native';
import { checkAccessibilityEnabled } from './accessibility';
import { notificationText } from '../assets/data/textContent';


export async function scheduleDailyNotification() {

    const isAccessibilityOn = await checkAccessibilityEnabled();

    if (isAccessibilityOn) {
        console.log('Accessibility service is ON — skipping notification');
        return;
    }

    const text = notificationText;

    const bigTextStyle: AndroidBigTextStyle = {
        type: AndroidStyle.BIGTEXT,
        text: text
    };

    // Schedule daily notification starting at 9:00 AM next time
    const date = new Date(Date.now());
    date.setHours(18);
    date.setMinutes(17);
    date.setSeconds(30);

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
            title: 'Accessibility Service Needed',
            android: {
                channelId: 'default',
                showTimestamp: true,
                style: bigTextStyle,
                pressAction: {
                    id: 'default',
                    launchActivity: 'com.blocksiteapp.OpenAccessibilityActivity',
                    launchActivityFlags: [AndroidLaunchActivityFlag.NEW_TASK],
                },
            },
        },
        trigger
    );
}
