import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import BaseScreen from "../components/BaseScreen";
import React, { useState } from "react";
import Icon from "../components/Icon";
import { NavigationProp, RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import { BlockedWebsitesData, RootStackNavigation, RootStackParamList } from "../types/types";
import TimeInput from "../components/TimeInput";
import NextButton from "../components/NextButton";
import { BlurView } from "@react-native-community/blur";
import AsyncStorage from "@react-native-async-storage/async-storage";

const ScheduleScreen: React.FC = () => {

    const navigation = useNavigation<RootStackNavigation>();

    type ScheduleScreenRouteProp = RouteProp<RootStackParamList, 'Schedule'>;

    const route = useRoute<ScheduleScreenRouteProp>();
    const { websiteUrl } = route.params;

    const [showMoreCalendar, setShowMoreCalendar] = useState(false);
    const [showMoreTime, setShowMoreTime] = useState(false);

   
    const days: Array<string>= ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const [selectedDays, setSelectedDays] = useState<boolean[]>(Array(days.length).fill(true));

    const [startHour, setStartHour] = useState<string>('');
    const [startMinutes, setStartMinutes] = useState<string>('');
    
    const [endHour, setEndHour] = useState<string>('');
    const [endMinutes, setEndMinutes] = useState<string>('');

    const [showPopup, setShowPopup] = useState(false);
    
    const handleToggleCalendarArrow = () => {
        setShowMoreCalendar(prev => !prev);
        if (showMoreTime) {
          setShowMoreTime(prev => !prev);
        }
    };

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

    const handleToggleTimeArrow = () => {
        setShowMoreTime(prev => !prev);
        if (showMoreCalendar) {
          setShowMoreCalendar(prev => !prev);
        }
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
                    <Pressable onPress={handleToggleCalendarArrow}>
                        <View style={styles.arrowIconContainer}>
                            <Icon name="Arrow" 
                                size={18}
                                style={[
                                    styles.rightIcon,
                                    {transform: [{rotate: showMoreCalendar ? '180deg' : '0deg'}]} 
                                ]} 
                            />
                        </View>
                    </Pressable>
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
                    <Pressable onPress={handleToggleTimeArrow}>
                        <View style={styles.arrowIconContainer}>
                            <Icon name="Arrow" 
                                size={18}
                                style={[
                                    styles.rightIcon,
                                    {transform: [{rotate: showMoreTime ? '180deg' : '0deg'}]} 
                                ]} 
                            />
                        </View>
                    </Pressable>
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
            <NextButton onPress={() => setShowPopup(true)} />
            <Popup 
                navigation={navigation}
                visible={showPopup} 
                onClose={() => setShowPopup(false)}  
                days={getSelectedDaysText()}
                time={getSelectedTimeText()}
                websiteUrl={websiteUrl}
            />
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



    blurContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
      },
      popup: {
        backgroundColor: 'white',
        padding: 20,
        borderRadius: 10,
        width: 300,
        alignItems: 'center',
      },
      popupText: {
        fontSize: 16,
        marginBottom: 10,
        textAlign: 'center',
        opacity: 0.8,
      },
      bold: {
        fontWeight: 'bold',
        fontSize: 18,
      },
      buttonsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
      },
      cancelButton: {
        backgroundColor: '#f44336',
        padding: 10,
        borderRadius: 5,
        marginRight: 10,
        width: 80,
        justifyContent: 'center',
        alignItems: 'center',
      },
      confirmButton: {
        backgroundColor: '#4CAF50',
        padding: 10,
        borderRadius: 5,
        width: 80,
        alignItems: 'center',
        justifyContent: 'center',
      },
      buttonText: {
        color: 'white',
        fontWeight: 'bold',
      },
});

export default ScheduleScreen;

interface PopupProps {
    navigation: NavigationProp<RootStackParamList>;
    visible: boolean;
    onClose: () => void;
    days: string;
    time: string;
    websiteUrl: string;
}

const Popup: React.FC<PopupProps> = ({
    navigation,
    visible,
    onClose,
    days, 
    time,
    websiteUrl 
}) => {

    const onConfirm = async () => {
        const newBlockedData: BlockedWebsitesData = {
            days,
            time,
            websiteUrl,
            visible: true,
        };

        try {
            const existingData = await AsyncStorage.getItem('@blocked_websites');
            const websites = existingData ? JSON.parse(existingData) : [];

            websites.push(newBlockedData);

            await AsyncStorage.setItem('@blocked_websites', JSON.stringify(websites));

            navigation.navigate('BottomTabs')
        } catch (error) {
            console.error('Error saving blocked website data', error);
        }
    };

    return (
        <Modal
            animationType="fade"
            transparent
            visible={visible}
            onRequestClose={onClose}
        >
            <BlurView 
            blurType="light"
            blurAmount={10}
            style={styles.blurContainer}
            >
            <View style={styles.popup}>
                <Text style={styles.popupText}>
                Are you sure you want to put <Text style={styles.bold}>{websiteUrl}</Text> on a block list?
                </Text>
                <Text style={styles.popupText}>
                For the following days: <Text style={styles.bold}>{days}</Text>
                </Text>
                <Text style={styles.popupText}>
                Blocking hour: <Text style={styles.bold}>{time}</Text>
                </Text>
    
                <View style={styles.buttonsContainer}>
                <Pressable style={styles.cancelButton} onPress={onClose}>
                    <Text style={styles.buttonText}>Cancel</Text>
                </Pressable>
                <Pressable style={styles.confirmButton} onPress={onConfirm}>
                    <Text style={styles.buttonText}>Confirm</Text>
                </Pressable>
                </View>
            </View>
            </BlurView>
        </Modal>
    );
};