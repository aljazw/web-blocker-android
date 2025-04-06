import { Pressable, StyleSheet, Text, View } from "react-native";
import BaseScreen from "../components/BaseScreen";
import React, { useState } from "react";
import Icon from "../components/Icon";
import { RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import { RootStackNavigation, RootStackParamList } from "../types/types";
import TimeInput from "../components/TimeInput";
import NextButton from "../components/NextButton";

const ScheduleScreen: React.FC = () => {

    const navigation = useNavigation<RootStackNavigation>();

    type ScheduleScreenRouteProp = RouteProp<RootStackParamList, 'Schedule'>;

    const route = useRoute<ScheduleScreenRouteProp>();
    // const { website } = route.params;

    const [showMoreCalendar, setShowMoreCalendar] = useState(false);
    const [showMoreTime, setShowMoreTime] = useState(false);

   
    const days: Array<string>= ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const [selectedDays, setSelectedDays] = useState<boolean[]>(Array(days.length).fill(true));

    const [startHour, setStartHour] = useState<string>('');
    const [startMinutes, setStartMinutes] = useState<string>('');
    
    const [endHour, setEndHour] = useState<string>('');
    const [endMinutes, setEndMinutes] = useState<string>('');
    

    const toggleDay = (index: number) => {
        setSelectedDays(prev => {
            const newSelected = [...prev];
            newSelected[index] = !newSelected[index];
            return newSelected;
        });
    };

    const getSelectedDaysText = () => {
        if (selectedDays.every(selectedDay => selectedDay)) {
            return 'Full Week';
        }

        const selectedNames = days.filter((_, index) => selectedDays[index]);
        return selectedNames.join(', ');
    };

    const getSelectedTimeText = () => {
        if (!startHour || !startMinutes || !endHour || !endMinutes) {
            return 'All Day Long';
        }
      
        // Ensure the start and end times are valid (hours between 00-23, minutes between 00-59)
        if (
            parseInt(startHour) < 0 || parseInt(startHour) > 23 || 
            parseInt(startMinutes) < 0 || parseInt(startMinutes) > 59 ||
            parseInt(endHour) < 0 || parseInt(endHour) > 23 || 
            parseInt(endMinutes) < 0 || parseInt(endMinutes) > 59
        ) {
            return 'Invalid Time';
        }
      
        return `${startHour}:${startMinutes} - ${endHour}:${endMinutes}`;
    };

    const clearTime = () => {
        setStartHour('');
        setStartMinutes('');
        setEndHour('');
        setEndMinutes('');
    }


    const handlePressNext = () => {
        navigation.navigate('BottomTabs')
    }
    

    return (
        <BaseScreen title="Schedule">
            <View style={styles.itemContainer}>
                <View style={styles.itemLessContainer}>
                    <View style={styles.itemInnerLeftContainer}>
                        <Icon name="Calendar" style={styles.leftIcon} size={30}/>
                        <View>
                            <Text>Days</Text>
                            <Text style={styles.durationText}>{getSelectedDaysText()}</Text>
                        </View>
                    </View>
                    {showMoreCalendar ? (
                        <Pressable onPress={() => setShowMoreCalendar(prev => !prev)}>
                            <View style={styles.arrowIconContainer}>
                                <Icon name="Up" style={styles.rightIcon} size={20}/>
                            </View>
                            
                        </Pressable>
                    ) : (
                        <Pressable onPress={() => setShowMoreCalendar(prev => !prev)}>
                            <View style={styles.arrowIconContainer}>
                                <Icon name="Down" style={styles.rightIcon} size={18}/>
                            </View>
                        </Pressable>
                    )}
                </View>
                {showMoreCalendar && (
                    <View style={styles.itemMoreContainer}>
                        {days.map((day, index) => (
                            <Pressable 
                            key={index} 
                            style={[
                                styles.dayContainer,
                                !selectedDays[index] && styles.selectedDayContainer
                            ]}
                            onPress={() => toggleDay(index)}
                            >
                                <Text style={[
                                    styles.dayText,
                                    !selectedDays[index] && styles.selectedDayText
                                    ]}
                                >
                                    {day.charAt(0)}
                                </Text>
                            </Pressable>
                        ))}
                    </View>
                )}
            </View>
            <View style={styles.itemContainer}>
                <View style={styles.itemLessContainer}>
                    <View style={styles.itemInnerLeftContainer}>
                        <Icon name="Time" style={styles.leftIcon} size={28}/>
                        <View>
                            <Text>Time</Text>
                            <Text style={styles.durationText}>{getSelectedTimeText()}</Text>
                        </View>
                    </View>
                    {showMoreTime ? (
                        <Pressable onPress={() => setShowMoreTime(prev => !prev)}>
                            <View style={styles.arrowIconContainer}>
                                <Icon name="Up" style={styles.rightIcon} size={20}/>
                            </View>
                            
                        </Pressable>
                    ) : (
                        <Pressable onPress={() => setShowMoreTime(prev => !prev)}>
                            <View style={styles.arrowIconContainer}>
                                <Icon name="Down" style={styles.rightIcon} size={18}/>
                            </View>
                        </Pressable>
                    )}
                </View>
                {showMoreTime && (
                    <View>
                        <TimeInput 
                        label="Start Time (HH:mm)"
                        hourValue={startHour}
                        minutesValue={startMinutes}
                        setHour={setStartHour}
                        setMinutes={setStartMinutes}
                        />
                        <TimeInput
                        label="End Time (HH:mm)"
                        hourValue={endHour}
                        minutesValue={endMinutes}
                        setHour={setEndHour}
                        setMinutes={setEndMinutes}
                        />
                        <Pressable onPress={clearTime}>
                            <Text style={styles.clearText}>Clear</Text>
                        </Pressable>
                  </View>
                )}
            </View>
            <NextButton onPress={handlePressNext} />
        </BaseScreen>
    );
};

const styles = StyleSheet.create({
    itemContainer: {
        justifyContent: 'center',
        alignItems: 'center',
        marginHorizontal: 10,
        marginTop: 20,
        paddingVertical: 13,
        paddingHorizontal: 15,
        borderRadius: 10,
        borderWidth: 1,  
        borderColor: '#e0e0e0',
    },
    itemLessContainer: {
        width: '100%',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    itemMoreContainer: {
        flexDirection: 'row',
    },
    itemInnerLeftContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    leftIcon: {
        marginRight: 15,
    },
    rightIcon: {
        opacity: 0.5,
    },
    durationText: {
        opacity: 0.5
    },
    dayContainer: {
        marginTop: 10,
        marginHorizontal: 5,
        padding: 7,
        width: 38,
        height: 38,
        borderRadius: 19,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#009a26',
    },
    selectedDayContainer: {
        borderColor: '#ccc',      
        borderWidth: 1,
        backgroundColor: '#f0f0f0'
    },
    dayText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 15,
    },
    selectedDayText: {
        color: 'gray',
        fontWeight: '600',  
    },
    arrowIconContainer: {
        width: 30,
        height: 30,
        alignItems: 'center',
        justifyContent: 'center',
    },
    clearText: {
        color: 'red',
        marginTop: 3,
    },
});

export default ScheduleScreen;
