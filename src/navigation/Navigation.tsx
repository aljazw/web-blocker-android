import { NavigationContainer } from "@react-navigation/native"
import { createStackNavigator } from "@react-navigation/stack"
import BottomTabNavigator from "./BottomTabNavigator";
import ScheduleScreen from "../screens/ScheduleScreen";
import AddSiteScreen from "../screens/AddSiteScreen";
import { RootStackParamList } from "../types/types";




const Stack = createStackNavigator<RootStackParamList>();

const Navigation: React.FC = () => {
    return (
        <NavigationContainer>
            <Stack.Navigator initialRouteName="BottomTabs">
                <Stack.Screen 
                    name="BottomTabs" 
                    component={BottomTabNavigator} 
                    options={{ headerShown: false}}
                />
                <Stack.Screen 
                    name="AddSite"
                    component={AddSiteScreen}
                    options={{headerShown: false}}
                />
                <Stack.Screen 
                    name="Schedule"
                    component={ScheduleScreen}
                    options={{headerShown: false}}
                />
            </Stack.Navigator>
        </NavigationContainer>
    )
};

export default Navigation;