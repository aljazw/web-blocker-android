/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */

import Navigation from './src/navigation/Navigation';
import { PassphraseProvider } from './src/context/PassphraseContext';
import { View } from 'react-native';
import WelcomeScreen from './src/screens/WelcomeScreen';
import { useAppInitializer } from './src/hooks/useAppInitializer';
import { setUserHasSeenWelcome } from './src/utils/storage';
import { openAccessibilitySettings } from './src/utils/accessibility';
import { ThemeProvider } from './src/context/ThemeContext';

function App(): React.JSX.Element {
    const { status, setStatus } = useAppInitializer();

    const handleWelcomeComplete = async () => {
        await setUserHasSeenWelcome(true);
        openAccessibilitySettings();
        setStatus('main');
    };

    if (status === 'loading') {
        return <View />;
    }

    return (
        <ThemeProvider>
            <PassphraseProvider>
                {status === 'welcome' ? <WelcomeScreen onContinue={handleWelcomeComplete} /> : <Navigation />}
            </PassphraseProvider>
        </ThemeProvider>
    );
}

export default App;
