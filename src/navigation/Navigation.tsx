import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import BottomTabNavigator from './BottomTabNavigator';
import ScheduleScreen from '../screens/ScheduleScreen';
import HabitEditorScreen from '../screens/HabitEditorScreen';
import { RootStackParamList } from '../types/types';

const Stack = createStackNavigator<RootStackParamList>();

const Navigation: React.FC = () => {
    return (
        <NavigationContainer>
            <Stack.Navigator initialRouteName="BottomTabs">
                <Stack.Screen name="BottomTabs" component={BottomTabNavigator} options={{ headerShown: false }} />
                <Stack.Screen name="Schedule" component={ScheduleScreen} options={{ headerShown: false }} />
                <Stack.Screen name="HabitEditor" component={HabitEditorScreen} options={{ headerShown: false }} />
            </Stack.Navigator>
        </NavigationContainer>
    );
};

export default Navigation;
