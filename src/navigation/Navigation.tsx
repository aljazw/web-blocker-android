import { useCallback, useMemo, useRef } from 'react';
import { DarkTheme, DefaultTheme, NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import BottomTabNavigator from './BottomTabNavigator';
import ScheduleScreen from '../screens/ScheduleScreen';
import HabitEditorScreen from '../screens/HabitEditorScreen';
import ApneaTableScreen from '../screens/ApneaTableScreen';
import ApneaSessionScreen from '../screens/ApneaSessionScreen';
import ApneaHistoryScreen from '../screens/ApneaHistoryScreen';
import ApneaSettingsScreen from '../screens/ApneaSettingsScreen';
import SleepScreen from '../screens/SleepScreen';
import VacationScreen from '../screens/VacationScreen';
import SettingsScreen from '../screens/SettingsScreen';
import WorkoutEditorScreen from '../screens/WorkoutEditorScreen';
import WorkoutSessionScreen from '../screens/WorkoutSessionScreen';
import PlanBlockEditorScreen from '../screens/PlanBlockEditorScreen';
import PlanNudge from '../components/PlanNudge';
import { RootStackParamList } from '../types/types';
import { useAppForeground } from '../hooks/useAppForeground';
import { useTheme } from '../context/ThemeContext';
import { apneaSession } from '../utils/apneaSession';
import { getWorkoutSession } from '../storage';

const Stack = createNativeStackNavigator<RootStackParamList>();
const navigationRef = createNavigationContainerRef<RootStackParamList>();

/** Screens where a plan pop-up would get in the way: training and editing. */
const NO_NUDGE: string[] = [
    'ApneaSession',
    'WorkoutSession',
    'ApneaTable',
    'HabitEditor',
    'WorkoutEditor',
    'PlanBlockEditor',
    'Schedule',
];

const canNudge = () => {
    const route = navigationRef.isReady() ? navigationRef.getCurrentRoute()?.name : undefined;
    return !!route && !NO_NUDGE.includes(route);
};

const openPlan = () => {
    if (navigationRef.isReady()) {
        navigationRef.navigate('BottomTabs', { screen: 'Habits', params: { view: 'plan' } });
    }
};

const Navigation: React.FC = () => {
    const { theme, isDarkMode } = useTheme();
    // Matches the app's colors, so no white flashes behind screen transitions.
    const navTheme = useMemo(() => {
        const base = isDarkMode ? DarkTheme : DefaultTheme;
        return {
            ...base,
            colors: {
                ...base.colors,
                background: theme.colors.background,
                card: theme.colors.card,
                border: theme.colors.border,
                text: theme.colors.text,
                primary: theme.colors.accent,
            },
        };
    }, [isDarkMode, theme]);
    const checking = useRef(false);

    /**
     * Training keeps going while the app is closed. When the app opens or
     * returns to the foreground mid-session (apnea or workout), go straight
     * back to it.
     */
    const resumeActiveSession = useCallback(async () => {
        if (checking.current || !navigationRef.isReady()) {
            return;
        }
        checking.current = true;
        try {
            const state = await apneaSession.getState();
            const live = state.status === 'running' || state.status === 'paused';
            const route = navigationRef.getCurrentRoute()?.name;
            if (live || state.status === 'finished') {
                if (route !== 'ApneaSession') {
                    navigationRef.navigate('ApneaSession');
                }
            } else if ((await getWorkoutSession()) && route !== 'WorkoutSession') {
                navigationRef.navigate('WorkoutSession');
            }
        } finally {
            checking.current = false;
        }
    }, []);
    useAppForeground(resumeActiveSession);

    return (
        <NavigationContainer ref={navigationRef} theme={navTheme} onReady={resumeActiveSession}>
            <Stack.Navigator
                initialRouteName="BottomTabs"
                screenOptions={{
                    headerShown: false,
                    // Native transitions run on the UI thread, so they stay smooth while JS is busy.
                    animation: 'slide_from_right',
                    animationDuration: 250,
                    freezeOnBlur: true,
                    contentStyle: { backgroundColor: theme.colors.background },
                }}>
                <Stack.Screen name="BottomTabs" component={BottomTabNavigator} />
                <Stack.Screen name="Schedule" component={ScheduleScreen} />
                <Stack.Screen name="HabitEditor" component={HabitEditorScreen} />
                <Stack.Screen name="ApneaTable" component={ApneaTableScreen} />
                <Stack.Screen name="ApneaSession" component={ApneaSessionScreen} options={{ gestureEnabled: false }} />
                <Stack.Screen name="ApneaHistory" component={ApneaHistoryScreen} />
                <Stack.Screen name="ApneaSettings" component={ApneaSettingsScreen} />
                <Stack.Screen name="Sleep" component={SleepScreen} />
                <Stack.Screen name="Vacation" component={VacationScreen} />
                <Stack.Screen name="Settings" component={SettingsScreen} />
                <Stack.Screen name="WorkoutEditor" component={WorkoutEditorScreen} />
                <Stack.Screen
                    name="WorkoutSession"
                    component={WorkoutSessionScreen}
                    options={{ gestureEnabled: false }}
                />
                <Stack.Screen name="PlanBlockEditor" component={PlanBlockEditorScreen} />
            </Stack.Navigator>
            <PlanNudge canShow={canNudge} onOpenPlan={openPlan} />
        </NavigationContainer>
    );
};

export default Navigation;
