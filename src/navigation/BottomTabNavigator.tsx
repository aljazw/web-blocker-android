import { createBottomTabNavigator } from "@react-navigation/bottom-tabs"
import Icon from "../components/Icon";
import HomeScreen from "../screens/HomeScreen";
import BlockScreen from "../screens/BlockScreen";

const Tab = createBottomTabNavigator();

const BottomTabNavigator: React.FC = () => {
    return(
        <Tab.Navigator
            screenOptions={({ route }) => ({
                tabBarIcon: ({ size }) => (
                    <Icon name={route.name} size={size} />
                ),
                tabBarActiveTintColor:'tomato',
                tabBarInactiveTintColor: 'gray',
                headerShown: false, 
            })}
        >
            <Tab.Screen name="Home" component={HomeScreen} />
            <Tab.Screen name="Block" component={BlockScreen} />
        </Tab.Navigator>
    );
};

export default BottomTabNavigator;