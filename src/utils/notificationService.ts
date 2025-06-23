import notifee, { TimestampTrigger, TriggerType, AndroidBigTextStyle, AndroidStyle, AndroidLaunchActivityFlag } from '@notifee/react-native';
import { checkAccessibilityEnabled } from './accessibility';


export async function scheduleDailyNotification() {

    const isAccessibilityOn = await checkAccessibilityEnabled();

    if (isAccessibilityOn) {
        console.log('Accessibility service is ON — skipping notification');
        return;
    }

const text = `🔧 Please enable Accessibility Service for BlockSiteApp:

1️⃣ Open Accessibility settings (click here).
2️⃣ Scroll to 'Installed Services' (or 'Downloaded Services').
3️⃣ Find & tap 'BlockSiteApp'.
4️⃣ Toggle it ON 
5️⃣ Confirm any prompts.

This lets the app block distracting sites and keep you focused! 🔒`;


    const bigTextStyle: AndroidBigTextStyle = {
        type: AndroidStyle.BIGTEXT,
        text: text
    };

  // Show notification immediately
    await notifee.displayNotification({
        title: 'Accessibility Service Needed!',
        android: {
            channelId: 'default',
            style: bigTextStyle,
            pressAction: {
                id: 'default',
                launchActivity: 'com.blocksiteapp.OpenAccessibilityActivity',
                launchActivityFlags: [AndroidLaunchActivityFlag.NEW_TASK],
            },
        }
    });

    // Schedule daily notification starting at 9:00 AM next time
    const date = new Date(Date.now());
    date.setHours(9);
    date.setMinutes(0);
    date.setSeconds(0);

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
