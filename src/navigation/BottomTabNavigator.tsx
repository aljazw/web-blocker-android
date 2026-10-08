import { StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Icon from '../components/Icon';
import HomeScreen from '../screens/HomeScreen';
import HabitsScreen from '../screens/HabitsScreen';
import BreatheScreen from '../screens/BreatheScreen';
import BlockScreen from '../screens/BlockScreen';
import SettingsScreen from '../screens/SettingsScreen';
import { useTheme } from '../context/ThemeContext';
import { TabParamList } from '../types/types';

const Tab = createBottomTabNavigator<TabParamList>();

const TAB_LABELS: Record<keyof TabParamList, string> = {
    Home: 'Overview',
    Habits: 'Habits',
    Breathe: 'Apnea',
    Block: 'Block',
    Settings: 'Settings',
};

/** Defined outside the navigator so React keeps a stable component identity. */
const tabIcon =
    (name: keyof TabParamList) =>
    ({ color, focused }: { color: string; focused: boolean }) =>
        <Icon name={name} size={21} tint={color} strokeWidth={focused ? 2.1 : 1.8} />;

const BottomTabNavigator: React.FC = () => {
    const { theme } = useTheme();

    return (
        <Tab.Navigator
            screenOptions={({ route }) => ({
                headerShown: false,
                tabBarHideOnKeyboard: true,
                tabBarLabel: TAB_LABELS[route.name],
                tabBarActiveTintColor: theme.colors.accent,
                tabBarInactiveTintColor: theme.colors.muted,
                tabBarLabelStyle: styles.label,
                tabBarStyle: {
                    backgroundColor: theme.colors.card,
                    borderTopColor: theme.colors.border,
                    borderTopWidth: StyleSheet.hairlineWidth,
                    elevation: 0,
                    height: 62,
                    paddingTop: 6,
                },
                tabBarIcon: tabIcon(route.name),
            })}>
            <Tab.Screen name="Home" component={HomeScreen} />
            <Tab.Screen name="Habits" component={HabitsScreen} />
            <Tab.Screen name="Breathe" component={BreatheScreen} />
            <Tab.Screen name="Block" component={BlockScreen} />
            <Tab.Screen name="Settings" component={SettingsScreen} />
        </Tab.Navigator>
    );
};

const styles = StyleSheet.create({
    label: {
        fontSize: 11,
        fontWeight: '500',
        marginTop: 2,
    },
});

export default BottomTabNavigator;
