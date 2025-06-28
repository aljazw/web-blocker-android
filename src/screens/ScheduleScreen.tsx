import { Pressable, StyleSheet, View } from 'react-native';
import BaseScreen from '../components/BaseScreen';
import React, { useState } from 'react';
import Icon from '../components/Icon';
import { NavigationProp, RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { BlockedWebsitesData, RootStackNavigation, RootStackParamList } from '../types/types';
import TimeInput from '../components/TimeInput';
import NextButton from '../components/NextButton';
import ActionButton from '../components/ActionButton';
import BlurModal from '../components/BlurModal';
import { shapes, spacing, useTheme } from '../theme';
import { ThemedText } from '../components/ThemedText';
import { addBlockedWebsite } from '../utils/storage';
import ErrorPopup from '../components/ErrorPopup';

const ScheduleScreen: React.FC = () => {
    const navigation = useNavigation<RootStackNavigation>();
    type ScheduleScreenRouteProp = RouteProp<RootStackParamList, 'Schedule'>;

    const route = useRoute<ScheduleScreenRouteProp>();
    const { websiteUrl } = route.params;

    const [showMoreCalendar, setShowMoreCalendar] = useState(false);
    const [showMoreTime, setShowMoreTime] = useState(false);

    const days: Array<string> = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const [selectedDays, setSelectedDays] = useState<boolean[]>(Array(days.length).fill(true));

    const [startHour, setStartHour] = useState<string>('');
    const [startMinutes, setStartMinutes] = useState<string>('');

    const [endHour, setEndHour] = useState<string>('');
    const [endMinutes, setEndMinutes] = useState<string>('');

    const [popupVisible, setPopupVisible] = useState(false);
    const [errorPopupVisible, setErrorPopupVisible] = useState(false);
    const [errorTitle, setErrorTitle] = useState('');
    const [errorText, setErrorText] = useState('');

    const showError = (title: string, text: string) => {
        setErrorTitle(title);
        setErrorText(text);
        setErrorPopupVisible(true);
    };

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
            parseInt(startHour, 10) < 0 ||
            parseInt(startHour, 10) > 23 ||
            parseInt(startMinutes, 10) < 0 ||
            parseInt(startMinutes, 10) > 59 ||
            parseInt(endHour, 10) < 0 ||
            parseInt(endHour, 10) > 23 ||
            parseInt(endMinutes, 10) < 0 ||
            parseInt(endMinutes, 10) > 59
        ) {
            return 'Invalid Time';
        }

        return `${startHour.padStart(2, '0')}:${startMinutes.padStart(2, '0')} - ${endHour.padStart(
            2,
            '0',
        )}:${endMinutes.padStart(2, '0')}`;
    };

    const clearTime = () => {
        setStartHour('');
        setStartMinutes('');
        setEndHour('');
        setEndMinutes('');
    };

    const { theme } = useTheme();

    return (
        <BaseScreen title="Schedule">
            <View style={styles.itemContainer}>
                <View style={styles.itemLessContainer}>
                    <View style={styles.itemInnerLeftContainer}>
                        <Icon name="Calendar" tint={false} style={styles.leftIcon} size={30} />
                        <View>
                            <ThemedText>Days</ThemedText>
                            <ThemedText opacity="faded">{getSelectedDaysText()}</ThemedText>
                        </View>
                    </View>
                    <Pressable onPress={handleToggleCalendarArrow}>
                        <View style={styles.arrowIconContainer}>
                            <Icon
                                name="Arrow"
                                size={18}
                                opacity="faded"
                                style={[
                                    {
                                        transform: [
                                            {
                                                rotate: showMoreCalendar ? '180deg' : '0deg',
                                            },
                                        ],
                                    },
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
                                    !selectedDays[index] && {
                                        backgroundColor: theme.colors.card,
                                        borderWidth: shapes.borderWidth.thin,
                                        borderColor: theme.colors.border,
                                    },
                                ]}
                                onPress={() => toggleDay(index)}>
                                <ThemedText
                                    size="small"
                                    weight="strong"
                                    style={[
                                        selectedDays[index] ? styles.dayTextSelected : {},
                                        !selectedDays[index] ? styles.dayTextUnselected : {},
                                    ]}>
                                    {day.charAt(0)}
                                </ThemedText>
                            </Pressable>
                        ))}
                    </View>
                )}
            </View>
            <View style={styles.itemContainer}>
                <View style={styles.itemLessContainer}>
                    <View style={styles.itemInnerLeftContainer}>
                        <Icon name="Time" style={styles.leftIcon} size={28} />
                        <View>
                            <ThemedText>Time</ThemedText>
                            <ThemedText opacity="faded">{getSelectedTimeText()}</ThemedText>
                        </View>
                    </View>
                    <Pressable onPress={handleToggleTimeArrow}>
                        <View style={styles.arrowIconContainer}>
                            <Icon
                                name="Arrow"
                                size={18}
                                opacity="faded"
                                style={[
                                    {
                                        transform: [
                                            {
                                                rotate: showMoreTime ? '180deg' : '0deg',
                                            },
                                        ],
                                    },
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
                            <ThemedText color="primaryRed" style={styles.clearText}>
                                Clear
                            </ThemedText>
                        </Pressable>
                    </View>
                )}
            </View>
            <NextButton onPress={() => setPopupVisible(true)} />
            <Popup
                navigation={navigation}
                visible={popupVisible}
                days={getSelectedDaysText()}
                time={getSelectedTimeText()}
                websiteUrl={websiteUrl}
                onClose={() => setPopupVisible(false)}
                showError={() => showError('Data Load Error', 'Failed to save blocked website data')}
            />
            <ErrorPopup
                title={errorTitle}
                text={errorText}
                visible={errorPopupVisible}
                onClose={() => setErrorPopupVisible}
            />
        </BaseScreen>
    );
};

interface PopupProps {
    navigation: NavigationProp<RootStackParamList>;
    visible: boolean;
    days: string;
    time: string;
    websiteUrl: string;
    onClose: () => void;
    showError: () => void;
}

const Popup: React.FC<PopupProps> = ({ navigation, visible, days, time, websiteUrl, onClose, showError }) => {
    const onConfirm = async () => {
        const newBlockedData: BlockedWebsitesData = {
            days,
            time,
            websiteUrl,
            visible: true,
        };

        const success = await addBlockedWebsite(newBlockedData);
        if (success) {
            navigation.navigate('BottomTabs');
        } else {
            showError();
        }
    };

    return (
        <BlurModal visible={visible} onClose={onClose}>
            <ThemedText align="center" style={styles.popUpText}>
                Are you sure you want to put{' '}
                <ThemedText color="primaryBlue" size="large" weight="strong">
                    {websiteUrl}
                </ThemedText>{' '}
                on a block list?
            </ThemedText>
            <ThemedText align="center" style={styles.popUpText}>
                For the following days: <ThemedText weight="medium">{days}</ThemedText>
            </ThemedText>
            <ThemedText align="center" style={styles.popUpText}>
                Blocking hour: <ThemedText weight="medium">{time}</ThemedText>
            </ThemedText>
            <View style={styles.buttonsContainer}>
                <ActionButton variant="cancel" onPress={onClose} />
                <ActionButton variant="confirm" onPress={onConfirm} />
            </View>
        </BlurModal>
    );
};

const styles = StyleSheet.create({
    itemContainer: {
        justifyContent: 'center',
        alignItems: 'center',
        marginHorizontal: spacing.sm,
        marginTop: spacing.lg,
        paddingVertical: 13,
        paddingHorizontal: spacing.md,
        borderRadius: shapes.borderRadius.medium,
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
        marginRight: spacing.md,
    },
    dayContainer: {
        marginTop: spacing.sm,
        marginHorizontal: 5,
        padding: 7,
        width: 38,
        height: 38,
        borderRadius: 19,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#009a26',
    },
    dayTextSelected: {
        color: 'white',
    },
    dayTextUnselected: {
        opacity: 0.6,
    },
    arrowIconContainer: {
        width: 30,
        height: 30,
        alignItems: 'center',
        justifyContent: 'center',
    },
    clearText: {
        marginTop: spacing.xs,
    },
    buttonsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    popUpText: {
        marginBottom: spacing.sm,
    },
});

export default ScheduleScreen;
