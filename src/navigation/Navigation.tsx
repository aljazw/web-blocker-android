import { NavigationContainer } from "@react-navigation/native"
import { createStackNavigator } from "@react-navigation/stack"
import BlockScreen from "../screens/BlockScreen";
import HomeScreen from "../screens/HomeScreen";
import BottomTabNavigator from "./BottomTabNavigator";



const Stack = createStackNavigator();

const Navigation: React.FC = () => {
    return (
        <NavigationContainer>
            <Stack.Navigator initialRouteName="BottomTabs">
                <Stack.Screen 
                    name="BottomTabs" 
                    component={BottomTabNavigator} 
                    options={{ headerShown: false}}
                />
            </Stack.Navigator>
        </NavigationContainer>
    )
};

export default Navigation;