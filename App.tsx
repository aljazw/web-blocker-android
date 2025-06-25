/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */

import React, { useEffect, useState } from 'react';

import Navigation from './src/navigation/Navigation';
import { ThemeProvider } from './src/theme';
import { PassphraseProvider } from './src/context/PassphraseContext';
import { NativeModules, View } from 'react-native';
import WelcomeScreen from './src/screens/WelcomeScreen';
import { checkAccessibilityEnabled, openAccessibilitySettings } from './src/utils/accessibility';
import notifee from '@notifee/react-native';
import { scheduleDailyNotification } from './src/utils/notificationService';


function App(): React.JSX.Element {

   const [showWelcome, setShowWelcome] = useState<boolean | null>(null); // null = still loading
   const { SharedStorage } = NativeModules;

    useEffect(() => {
        const initializeApp = async () => {
            // Check if welcome screen should be shown
            const hasSeenWelcome = await SharedStorage.getItem('@has_seen_welcome');
            setShowWelcome(hasSeenWelcome !== 'true');

            // Create notification channel
            await notifee.createChannel({
                id: 'default',
                name: 'Default Channel',
            });

            // Check if notification should be scheduled
            const alreadyScheduled = await SharedStorage.getItem('@notification_scheduled');
            const accessibilityEnabled = await checkAccessibilityEnabled();

            if (!accessibilityEnabled) {
                if (alreadyScheduled !== 'true') {
                    await scheduleDailyNotification();
                    await SharedStorage.setItem('@notification_scheduled', 'true');
                } else {
                    await SharedStorage.setItem('@notification_scheduled', 'false');
                }
            } else if (alreadyScheduled === 'true') {
                await notifee.cancelTriggerNotification('accessibility-reminder');
                await SharedStorage.setItem('@notification_scheduled', 'false');
            }
        };

        initializeApp();
    }, []);


    const handleWelcomeComplete = async () => {
        await SharedStorage.setItem('@has_seen_welcome', 'true');
        openAccessibilitySettings();
        setShowWelcome(false);
    };

    if (showWelcome === null) return <View/>
    
    return (
        <ThemeProvider>
            <PassphraseProvider>
                {showWelcome ? (
                    <WelcomeScreen onContinue={handleWelcomeComplete} />
                ) : (
                <Navigation/>
                )}
            </PassphraseProvider>
        </ThemeProvider>
    );
}; 

export default App;
