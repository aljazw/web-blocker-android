import React, { useEffect } from 'react';
import { Text, StyleSheet, Image, TouchableOpacity, NativeModules, View } from 'react-native';
import BaseScreen from '../components/BaseScreen';
import { ThemedText } from '../components/ThemedText';
import { scheduleDailyNotification } from '../utils/notificationService';
import notifee from '@notifee/react-native';
import { shapes, spacing } from '../theme';


interface WelcomeScreenProps {
    onContinue: () => void;
}

const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onContinue }) => {

    const { SharedStorage} = NativeModules;

    useEffect(() => {
        const setupNotifications = async () => {
            // Step 1: Create the notification channel
            await notifee.createChannel({
                id: 'default',
                name: 'Default Channel',
            });

            // Step 2: Check and schedule daily notification
            const alreadyScheduled = await SharedStorage.getItem('@notification_scheduled');
            if (alreadyScheduled !== 'true') {
                await scheduleDailyNotification();
                await SharedStorage.setItem('@notification_scheduled', 'true');
            }
        };

        setupNotifications();
    }, []);



  return (
    <BaseScreen showHeader={false}>
        <View style={styles.container}>
            <Image
                source={require('../assets/icons/web-block-logo.png')}
                style={styles.image}
                resizeMode="contain"
            />
            <ThemedText weight="strong" size="xlarge" align="center" style={styles.title}>
                Welcome to FocusGuard
            </ThemedText>
            <ThemedText align="center" size="large" weight="medium" style={styles.subtitle}>
                To block distracting websites, please enable Accessibility permissions.
            </ThemedText>
            <StepList />
            <TouchableOpacity
                onPress={onContinue}
                style={styles.button}
            >
                <Text style={styles.buttonText}>Enable Accessibility</Text>
            </TouchableOpacity>
        </View>
    </BaseScreen>
  );
};

 const steps = [
    'Open Accessibility settings (click below).',
    'Scroll to "Installed Services" (or "Downloaded Services").',
    'Find & tap "BlockSiteApp".',
    'Toggle it ON.',
    'Confirm any prompts.',
];

export function StepList() {
  return (
    <View>
      {steps.map((step, index) => (
        <ThemedText key={index} style={styles.item}>
          {`${index + 1}️⃣ ${step}`}
        </ThemedText>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        alignItems: 'center',
        marginTop: spacing.xl,
        padding: spacing.lg,
    },
    image: {
        width: 180,
        height: 180,
    },
    title: {
        marginBottom: spacing.xxl,
    },
    subtitle: {
        marginBottom: spacing.lg,
    },
    button: {
        paddingVertical: 14,
        paddingHorizontal: 30,
        borderRadius: shapes.borderRadius.medium,
        backgroundColor: '#3b82f6', // a strong primary blue
        elevation: shapes.elevation.medium,               // adds shadow on Android
        shadowColor: '#000',        // iOS shadow
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: shapes.elevation.medium,
        marginTop: spacing.xxl,
        alignSelf: 'center',
    },
        buttonText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 16,
        textAlign: 'center',
    },
    item: {
        marginVertical: 2,
    },

});


export default WelcomeScreen;
