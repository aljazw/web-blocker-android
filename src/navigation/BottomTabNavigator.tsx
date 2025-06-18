import { createBottomTabNavigator } from "@react-navigation/bottom-tabs"
import Icon from "../components/Icon";
import HomeScreen from "../screens/HomeScreen";
import BlockScreen from "../screens/BlockScreen";
import SettingsScreen from "../screens/SettingsScreen";
import { useTheme } from "../theme";
import { useEffect } from "react";
import changeNavigationBarColor from "react-native-navigation-bar-color";

const Tab = createBottomTabNavigator();

const BottomTabNavigator: React.FC = () => {

    const { theme, isDarkMode } = useTheme();

    useEffect(() => {
        if (isDarkMode) {
        changeNavigationBarColor("#000000", false);
        } else {
        changeNavigationBarColor("#FFFFFF", true);
        }
    }, [isDarkMode]);

    return(
        <Tab.Navigator
            screenOptions={({ route }) => ({
                tabBarIcon: ({ size }) => (
                    <Icon name={route.name} size={30} tint="#f5f5dc"/>
                ),
                tabBarActiveTintColor:'tomato',
                tabBarInactiveTintColor: 'gray',
                tabBarStyle: {
                    height: 60,
                    backgroundColor: theme.colors.background,
                },
                headerShown: false, 
            })}
        >
            <Tab.Screen name="Home" component={HomeScreen} />
            <Tab.Screen name="Block" component={BlockScreen} />
            <Tab.Screen name="Settings" component={SettingsScreen} />
        </Tab.Navigator>
    );
};

export default BottomTabNavigator;