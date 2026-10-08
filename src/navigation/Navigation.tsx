import { useCallback, useRef } from 'react';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import BottomTabNavigator from './BottomTabNavigator';
import ScheduleScreen from '../screens/ScheduleScreen';
import HabitEditorScreen from '../screens/HabitEditorScreen';
import ApneaTableScreen from '../screens/ApneaTableScreen';
import ApneaSessionScreen from '../screens/ApneaSessionScreen';
import ApneaHistoryScreen from '../screens/ApneaHistoryScreen';
import ApneaSettingsScreen from '../screens/ApneaSettingsScreen';
import SleepScreen from '../screens/SleepScreen';
import { RootStackParamList } from '../types/types';
import { useAppForeground } from '../hooks/useAppForeground';
import { useTheme } from '../context/ThemeContext';
import { apneaSession } from '../utils/apneaSession';

const Stack = createStackNavigator<RootStackParamList>();
const navigationRef = createNavigationContainerRef<RootStackParamList>();

const Navigation: React.FC = () => {
    const { theme } = useTheme();
    const checking = useRef(false);

    /**
     * A training session keeps running while the app is closed. When the app
     * opens or returns to the foreground mid-session, go straight back to it.
     */
    const resumeActiveSession = useCallback(async () => {
        if (checking.current || !navigationRef.isReady()) {
            return;
        }
        checking.current = true;
        try {
            const state = await apneaSession.getState();
            const live = state.status === 'running' || state.status === 'paused';
            if ((live || state.status === 'finished') && navigationRef.getCurrentRoute()?.name !== 'ApneaSession') {
                navigationRef.navigate('ApneaSession');
            }
        } finally {
            checking.current = false;
        }
    }, []);
    useAppForeground(resumeActiveSession);

    return (
        <NavigationContainer ref={navigationRef} onReady={resumeActiveSession}>
            <Stack.Navigator
                initialRouteName="BottomTabs"
                screenOptions={{ headerShown: false, cardStyle: { backgroundColor: theme.colors.background } }}>
                <Stack.Screen name="BottomTabs" component={BottomTabNavigator} />
                <Stack.Screen name="Schedule" component={ScheduleScreen} />
                <Stack.Screen name="HabitEditor" component={HabitEditorScreen} />
                <Stack.Screen name="ApneaTable" component={ApneaTableScreen} />
                <Stack.Screen name="ApneaSession" component={ApneaSessionScreen} options={{ gestureEnabled: false }} />
                <Stack.Screen name="ApneaHistory" component={ApneaHistoryScreen} />
                <Stack.Screen name="ApneaSettings" component={ApneaSettingsScreen} />
                <Stack.Screen name="Sleep" component={SleepScreen} />
            </Stack.Navigator>
        </NavigationContainer>
    );
};

export default Navigation;
