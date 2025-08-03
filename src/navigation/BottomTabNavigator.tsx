import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Icon from '../components/Icon';
import HomeScreen from '../screens/HomeScreen';
import BlockScreen from '../screens/BlockScreen';
import SettingsScreen from '../screens/SettingsScreen';
import { useTheme } from '../context/ThemeContext';

const Tab = createBottomTabNavigator();

const BottomTabNavigator: React.FC = () => {
    const { theme } = useTheme();

    return (
        <Tab.Navigator
            screenOptions={({ route }) => ({
                ...renderTabIcon(route.name),
                tabBarActiveTintColor: 'tomato',
                tabBarInactiveTintColor: 'gray',
                tabBarStyle: {
                    height: 60,
                    backgroundColor: theme.colors.background,
                },
                headerShown: false,
            })}>
            <Tab.Screen name="Home" component={HomeScreen} />
            <Tab.Screen name="Block" component={BlockScreen} />
            <Tab.Screen name="Settings" component={SettingsScreen} />
        </Tab.Navigator>
    );
};

const renderTabIcon = (routeName: string) => ({
    tabBarIcon: () => <Icon name={routeName} size={30} tint="#f5f5dc" />,
});

export default BottomTabNavigator;
