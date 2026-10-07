import { StyleSheet, View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Icon from '../components/Icon';
import HomeScreen from '../screens/HomeScreen';
import BlockScreen from '../screens/BlockScreen';
import SettingsScreen from '../screens/SettingsScreen';
import { useTheme } from '../context/ThemeContext';
import { shapes } from '../theme';

const Tab = createBottomTabNavigator();

const TAB_LABELS: Record<string, string> = {
    Home: 'Overview',
    Block: 'Add site',
    Settings: 'Settings',
};

const BottomTabNavigator: React.FC = () => {
    const { theme } = useTheme();

    return (
        <Tab.Navigator
            screenOptions={({ route }) => ({
                headerShown: false,
                tabBarLabel: TAB_LABELS[route.name] ?? route.name,
                tabBarActiveTintColor: theme.colors.accent,
                tabBarInactiveTintColor: theme.colors.muted,
                tabBarLabelStyle: styles.label,
                tabBarStyle: {
                    backgroundColor: theme.colors.card,
                    borderTopColor: theme.colors.border,
                    elevation: 0,
                    height: 70,
                    paddingTop: 8,
                },
                tabBarIcon: ({ color, focused }) => (
                    <View style={[styles.iconPill, focused && { backgroundColor: theme.colors.accentSoft }]}>
                        <Icon name={route.name} size={22} tint={color} />
                    </View>
                ),
            })}>
            <Tab.Screen name="Home" component={HomeScreen} />
            <Tab.Screen name="Block" component={BlockScreen} />
            <Tab.Screen name="Settings" component={SettingsScreen} />
        </Tab.Navigator>
    );
};

const styles = StyleSheet.create({
    iconPill: {
        width: 56,
        height: 30,
        borderRadius: shapes.borderRadius.pill,
        alignItems: 'center',
        justifyContent: 'center',
    },
    label: {
        fontSize: 11,
        fontWeight: '600',
        marginTop: 4,
    },
});

export default BottomTabNavigator;
