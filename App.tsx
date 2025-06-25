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
import { openAccessibilitySettings } from './src/utils/accessibility';



function App(): React.JSX.Element {

   const [showWelcome, setShowWelcome] = useState<boolean | null>(null); // null = still loading
   const { SharedStorage } = NativeModules;

    useEffect(() => {
        const checkFirstLaunch = async () => {
            const hasSeenWelcome = await SharedStorage.getItem('@has_seen_welcome');
            setShowWelcome(hasSeenWelcome !== 'true');
        };
        checkFirstLaunch();
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
