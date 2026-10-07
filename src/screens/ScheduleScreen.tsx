import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import BaseScreen from '../components/BaseScreen';
import React, { useState } from 'react';
import Icon from '../components/Icon';
import { NavigationProp, RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { BlockedWebsitesData, RootStackNavigation, RootStackParamList } from '../types/types';
import TimeInput from '../components/TimeInput';
import ActionButton from '../components/ActionButton';
import BlurModal from '../components/BlurModal';
import Button from '../components/Button';
import Chip from '../components/Chip';
import Favicon from '../components/Favicon';
import SectionHeader from '../components/SectionHeader';
import { shapes, spacing } from '../theme';
import { ThemedText } from '../components/ThemedText';
import { ThemedView } from '../components/ThemedView';
import { addBlockedWebsite } from '../utils/storage';
import ErrorPopup from '../components/ErrorPopup';
import { useTheme } from '../context/ThemeContext';
import { ALL_DAY, FULL_WEEK, WEEK_DAYS } from '../utils/schedule';
import { FadeIn, animateLayout } from '../components/Motion';
import { haptics } from '../utils/haptics';

type Preset = {
    label: string;
    days: boolean[];
    time: [string, string, string, string] | null; // startH, startM, endH, endM — null = all day
};

const EVERY_DAY = [true, true, true, true, true, true, true];
const WEEKDAYS = [true, true, true, true, true, false, false];
const WEEKEND = [false, false, false, false, false, true, true];

const PRESETS: Preset[] = [
    { label: 'Always', days: EVERY_DAY, time: null },
    { label: 'Work hours', days: WEEKDAYS, time: ['09', '00', '17', '00'] },
    { label: 'Evenings', days: EVERY_DAY, time: ['18', '00', '23', '00'] },
    { label: 'Bedtime', days: EVERY_DAY, time: ['22', '00', '07', '00'] },
    { label: 'Weekends', days: WEEKEND, time: null },
];

const ScheduleScreen: React.FC = () => {
    const { theme } = useTheme();
    const navigation = useNavigation<RootStackNavigation>();
    type ScheduleScreenRouteProp = RouteProp<RootStackParamList, 'Schedule'>;

    const route = useRoute<ScheduleScreenRouteProp>();
    const { websiteUrl } = route.params;

    const [selectedDays, setSelectedDays] = useState<boolean[]>(EVERY_DAY);
    const [customTime, setCustomTime] = useState(false);

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

    const toggleDay = (index: number) => {
        haptics.tap();
        setSelectedDays(prev => prev.map((v, i) => (i === index ? !v : v)));
    };

    const applyPreset = (preset: Preset) => {
        animateLayout();
        setSelectedDays(preset.days);
        if (preset.time) {
            const [sh, sm, eh, em] = preset.time;
            setStartHour(sh);
            setStartMinutes(sm);
            setEndHour(eh);
            setEndMinutes(em);
            setCustomTime(true);
        } else {
            clearTime();
        }
    };

    const isPresetActive = (preset: Preset) => {
        const sameDays = preset.days.every((v, i) => v === selectedDays[i]);
        if (!sameDays) return false;
        if (!preset.time) return !customTime;
        return customTime && [startHour, startMinutes, endHour, endMinutes].join() === preset.time.join();
    };

    const getSelectedDaysText = () => {
        if (selectedDays.every(selectedDay => selectedDay)) {
            return FULL_WEEK;
        }
        return WEEK_DAYS.filter((_, index) => selectedDays[index]).join(', ');
    };

    const getSelectedTimeText = () => {
        if (!customTime || !startHour || !startMinutes || !endHour || !endMinutes) {
            return ALL_DAY;
        }

        // Ensure the start and end times are valid (hours between 00-23, minutes between 00-59)
        if (
            parseInt(startHour, 10) > 23 ||
            parseInt(startMinutes, 10) > 59 ||
            parseInt(endHour, 10) > 23 ||
            parseInt(endMinutes, 10) > 59
        ) {
            return 'Invalid Time';
        }

        const pad = (v: string) => v.padStart(2, '0');
        return `${pad(startHour)}:${pad(startMinutes)} - ${pad(endHour)}:${pad(endMinutes)}`;
    };

    const clearTime = () => {
        animateLayout();
        setStartHour('');
        setStartMinutes('');
        setEndHour('');
        setEndMinutes('');
        setCustomTime(false);
    };

    const daysText = getSelectedDaysText();
    const timeText = getSelectedTimeText();
    const noDays = !selectedDays.some(Boolean);
    const incompleteTime = customTime && [startHour, startMinutes, endHour, endMinutes].some(v => v.length === 0);
    const toMinutes = (h: string, m: string) => parseInt(h || '0', 10) * 60 + parseInt(m || '0', 10);
    const startTotal = toMinutes(startHour, startMinutes);
    const endTotal = toMinutes(endHour, endMinutes);
    const sameStartEnd = customTime && !incompleteTime && startTotal === endTotal;
    const overnight = customTime && !incompleteTime && timeText !== 'Invalid Time' && endTotal < startTotal;
    const problem = noDays
        ? 'Pick at least one day.'
        : timeText === 'Invalid Time'
        ? 'That time isn’t valid.'
        : incompleteTime
        ? 'Fill in both start and end times, or choose “All day”.'
        : sameStartEnd
        ? 'Start and end time can’t be the same.'
        : null;

    const backButton = (
        <Pressable
            onPress={() => navigation.goBack()}
            hitSlop={10}
            style={[styles.back, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            <Icon name="Back" size={20} />
        </Pressable>
    );

    return (
        <BaseScreen title="Schedule" subtitle="When should this site be blocked?" headerLeft={backButton}>
            <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
                <FadeIn>
                    <ThemedView withBorder style={styles.siteCard}>
                        <View style={[styles.faviconWrap, { backgroundColor: theme.colors.elevated }]}>
                            <Favicon url={websiteUrl} size={26} />
                        </View>
                        <View style={styles.flex}>
                            <ThemedText size="large" weight="strong" numberOfLines={1}>
                                {websiteUrl}
                            </ThemedText>
                            <ThemedText size="small" color="muted">
                                New block
                            </ThemedText>
                        </View>
                    </ThemedView>
                </FadeIn>

                <FadeIn delay={70}>
                    <SectionHeader title="Quick presets" />
                    <View style={styles.chips}>
                        {PRESETS.map(preset => (
                            <Chip
                                key={preset.label}
                                label={preset.label}
                                selected={isPresetActive(preset)}
                                onPress={() => applyPreset(preset)}
                            />
                        ))}
                    </View>
                </FadeIn>
                <FadeIn delay={140}>
                    <SectionHeader title="Days" />
                    <ThemedView withBorder style={styles.card}>
                        <View style={styles.daysRow}>
                            {WEEK_DAYS.map((day, index) => {
                                const on = selectedDays[index];
                                return (
                                    <Pressable
                                        key={day}
                                        onPress={() => toggleDay(index)}
                                        style={[
                                            styles.dayPill,
                                            on
                                                ? { backgroundColor: theme.colors.accent }
                                                : { backgroundColor: theme.colors.elevated },
                                        ]}>
                                        <ThemedText
                                            size="small"
                                            weight="strong"
                                            style={{ color: on ? theme.colors.onAccent : theme.colors.muted }}>
                                            {day.charAt(0)}
                                        </ThemedText>
                                    </Pressable>
                                );
                            })}
                        </View>
                        <ThemedText size="small" color="muted" align="center" style={styles.cardFoot}>
                            {noDays ? 'No days selected' : daysText === FULL_WEEK ? 'Every day' : daysText}
                        </ThemedText>
                    </ThemedView>
                </FadeIn>
                <FadeIn delay={210}>
                    <SectionHeader title="Time" />
                    <ThemedView withBorder style={styles.card}>
                        <View style={[styles.segment, { backgroundColor: theme.colors.elevated }]}>
                            <Segment label="All day" active={!customTime} onPress={clearTime} />
                            <Segment
                                label="Custom hours"
                                active={customTime}
                                onPress={() => {
                                    animateLayout();
                                    setCustomTime(true);
                                }}
                            />
                        </View>
                        {customTime && (
                            <View style={styles.timeRow}>
                                <TimeInput
                                    label="From"
                                    hourValue={startHour}
                                    minutesValue={startMinutes}
                                    setHour={setStartHour}
                                    setMinutes={setStartMinutes}
                                />
                                <View style={styles.timeGap} />
                                <TimeInput
                                    label="Until"
                                    hourValue={endHour}
                                    minutesValue={endMinutes}
                                    setHour={setEndHour}
                                    setMinutes={setEndMinutes}
                                />
                            </View>
                        )}
                        {overnight && (
                            <ThemedText size="small" color="muted" align="center" style={styles.cardFoot}>
                                Runs overnight, past midnight.
                            </ThemedText>
                        )}
                    </ThemedView>
                </FadeIn>
                {problem && (
                    <ThemedText size="small" color="primaryRed" align="center" style={styles.problem}>
                        {problem}
                    </ThemedText>
                )}
                <Button
                    label="Review & block"
                    icon="ArrowRight"
                    disabled={!!problem}
                    onPress={() => setPopupVisible(true)}
                    style={styles.save}
                />
            </ScrollView>

            <Popup
                navigation={navigation}
                visible={popupVisible}
                days={daysText}
                time={timeText}
                websiteUrl={websiteUrl}
                onClose={() => setPopupVisible(false)}
                showError={() => showError('Data Load Error', 'Failed to save blocked website data')}
            />
            <ErrorPopup
                title={errorTitle}
                text={errorText}
                visible={errorPopupVisible}
                onClose={() => setErrorPopupVisible(false)}
            />
        </BaseScreen>
    );
};

const Segment: React.FC<{ label: string; active: boolean; onPress: () => void }> = ({ label, active, onPress }) => {
    const { theme } = useTheme();
    return (
        <Pressable onPress={onPress} style={[styles.segmentItem, active && { backgroundColor: theme.colors.card }]}>
            <ThemedText size="small" weight="strong" style={{ color: active ? theme.colors.text : theme.colors.muted }}>
                {label}
            </ThemedText>
        </Pressable>
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
            haptics.success();
            onClose();
            navigation.navigate('BottomTabs', { screen: 'Home' });
        } else {
            showError();
        }
    };

    return (
        <BlurModal visible={visible} onClose={onClose}>
            <ThemedText size="large" weight="strong" align="center" style={styles.popUpText}>
                Block{' '}
                <ThemedText size="large" weight="strong" color="accent">
                    {websiteUrl}
                </ThemedText>
                ?
            </ThemedText>
            <View style={styles.summary}>
                <SummaryRow label="Days" value={days === FULL_WEEK ? 'Every day' : days} />
                <SummaryRow label="Hours" value={time === ALL_DAY ? 'All day' : time} />
            </View>
            <View style={styles.buttonsContainer}>
                <ActionButton variant="cancel" onPress={onClose} />
                <ActionButton variant="confirm" label="Block it" onPress={onConfirm} />
            </View>
        </BlurModal>
    );
};

const SummaryRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
    <View style={styles.summaryRow}>
        <ThemedText size="small" color="muted">
            {label}
        </ThemedText>
        <ThemedText size="small" weight="strong">
            {value}
        </ThemedText>
    </View>
);

const styles = StyleSheet.create({
    scroll: {
        paddingBottom: spacing.xl,
    },
    back: {
        width: 40,
        height: 40,
        borderRadius: 20,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: spacing.md,
    },
    flex: {
        flex: 1,
    },
    siteCard: {
        flexDirection: 'row',
        alignItems: 'center',
        marginHorizontal: spacing.md,
        marginTop: spacing.xs,
        padding: spacing.md,
        borderRadius: shapes.borderRadius.large,
    },
    faviconWrap: {
        width: 48,
        height: 48,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: spacing.md,
    },
    chips: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginHorizontal: spacing.md,
        marginTop: spacing.xs,
    },
    card: {
        marginHorizontal: spacing.md,
        padding: spacing.md,
        borderRadius: shapes.borderRadius.large,
    },
    cardFoot: {
        marginTop: spacing.sm,
    },
    daysRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    dayPill: {
        width: 38,
        height: 38,
        borderRadius: 19,
        alignItems: 'center',
        justifyContent: 'center',
    },
    segment: {
        flexDirection: 'row',
        borderRadius: shapes.borderRadius.pill,
        padding: 4,
    },
    segmentItem: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 9,
        borderRadius: shapes.borderRadius.pill,
    },
    timeRow: {
        flexDirection: 'row',
        marginTop: spacing.md,
    },
    timeGap: {
        width: spacing.md,
    },
    problem: {
        marginTop: spacing.lg,
        marginHorizontal: spacing.md,
    },
    save: {
        marginHorizontal: spacing.md,
        marginTop: spacing.md,
    },
    summary: {
        alignSelf: 'stretch',
        marginVertical: spacing.sm,
    },
    summaryRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 6,
    },
    buttonsContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginTop: spacing.md,
    },
    popUpText: {
        marginBottom: spacing.sm,
    },
});

export default ScheduleScreen;
