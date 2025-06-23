/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */

import React, { useEffect } from 'react';

import Navigation from './src/navigation/Navigation';
import { ThemeProvider } from './src/theme';
import { PassphraseProvider } from './src/context/PassphraseContext';
import notifee from '@notifee/react-native';
import { scheduleDailyNotification } from './src/utils/notificationService';


function App(): React.JSX.Element {

    useEffect(() => {
        async function createChannel() {
            await notifee.createChannel({
                id: 'default',
                name: 'Default Channel',
            });
        }
        createChannel();
    }, []);

    useEffect(() => {
        scheduleDailyNotification();
    }, []);

    
    return (
        <ThemeProvider>
            <PassphraseProvider>
                <Navigation/>
            </PassphraseProvider>
        </ThemeProvider>
    );
}; 

export default App;
