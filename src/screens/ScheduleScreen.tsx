import { ScrollView, StyleSheet, View } from 'react-native';
import BaseScreen from '../components/BaseScreen';
import React, { useState } from 'react';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { RootStackNavigation, RootStackParamList } from '../types/types';
import TimeInput from '../components/TimeInput';
import Button from '../components/Button';
import Card from '../components/Card';
import Dialog, { confirmActions } from '../components/Dialog';
import IconTile from '../components/IconTile';
import { KeyValueRow } from '../components/ListGroup';
import Chip from '../components/Chip';
import Segmented from '../components/Segmented';
import DayPicker from '../components/DayPicker';
import BackButton from '../components/BackButton';
import AppIcon from '../components/AppIcon';
import Favicon from '../components/Favicon';
import SectionHeader from '../components/SectionHeader';
import { gutter, spacing } from '../theme';
import { ThemedText } from '../components/ThemedText';
import { addBlockedApp, addBlockedWebsite } from '../utils/storage';
import ErrorPopup from '../components/ErrorPopup';
import { ALL_DAY, buildSchedule, describeDays } from '../utils/schedule';
import { ERRORS } from '../constants/strings';
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
    const navigation = useNavigation<RootStackNavigation>();
    type ScheduleScreenRouteProp = RouteProp<RootStackParamList, 'Schedule'>;

    const route = useRoute<ScheduleScreenRouteProp>();
    const { websiteUrl, app } = route.params;
    const targetLabel = app ? app.appName : websiteUrl ?? '';

    const [selectedDays, setSelectedDays] = useState<boolean[]>(EVERY_DAY);
    const [customTime, setCustomTime] = useState(false);

    const [startHour, setStartHour] = useState<string>('');
    const [startMinutes, setStartMinutes] = useState<string>('');
    const [endHour, setEndHour] = useState<string>('');
    const [endMinutes, setEndMinutes] = useState<string>('');

    const [dialog, setDialog] = useState<'review' | 'error' | null>(null);

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
        if (!sameDays) {
            return false;
        }
        if (!preset.time) {
            return !customTime;
        }
        return customTime && [startHour, startMinutes, endHour, endMinutes].join() === preset.time.join();
    };

    const clearTime = () => {
        animateLayout();
        setStartHour('');
        setStartMinutes('');
        setEndHour('');
        setEndMinutes('');
        setCustomTime(false);
    };

    const save = async () => {
        const success = app
            ? await addBlockedApp({
                  days: daysText,
                  time: timeText,
                  packageName: app.packageName,
                  appName: app.appName,
                  visible: true,
              })
            : await addBlockedWebsite({ days: daysText, time: timeText, websiteUrl: websiteUrl ?? '', visible: true });
        if (success) {
            haptics.success();
            setDialog(null);
            navigation.navigate('BottomTabs', { screen: 'Home' });
        } else {
            setDialog('error');
        }
    };

    const {
        days: daysText,
        time: timeText,
        problem,
        overnight,
    } = buildSchedule(selectedDays, customTime ? { startHour, startMinutes, endHour, endMinutes } : null);

    return (
        <BaseScreen
            title="Schedule"
            subtitle={app ? 'When should this app be blocked?' : 'When should this site be blocked?'}
            headerLeft={<BackButton />}>
            <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
                <FadeIn>
                    <Card style={styles.siteCard}>
                        <IconTile size={44} style={styles.leading}>
                            {app ? (
                                <AppIcon packageName={app.packageName} size={28} />
                            ) : (
                                <Favicon url={targetLabel} size={24} />
                            )}
                        </IconTile>
                        <View style={styles.flex}>
                            <ThemedText size="large" weight="strong" numberOfLines={1}>
                                {targetLabel}
                            </ThemedText>
                            <ThemedText size="small" color="muted">
                                {app ? 'New app block' : 'New website block'}
                            </ThemedText>
                        </View>
                    </Card>
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
                    <Card>
                        <DayPicker value={selectedDays} onChange={setSelectedDays} />
                        <ThemedText size="small" color="muted" align="center" style={styles.cardFoot}>
                            {selectedDays.some(Boolean) ? describeDays(daysText) : 'No days selected'}
                        </ThemedText>
                    </Card>
                </FadeIn>
                <FadeIn delay={210}>
                    <SectionHeader title="Time" />
                    <Card>
                        <Segmented
                            options={[
                                { value: 'all', label: 'All day' },
                                { value: 'custom', label: 'Custom hours' },
                            ]}
                            value={customTime ? 'custom' : 'all'}
                            onChange={v => (v === 'all' ? clearTime() : setCustomTime(true))}
                        />
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
                    </Card>
                </FadeIn>
                {problem && (
                    <ThemedText size="small" color="primaryRed" align="center" style={styles.problem}>
                        {problem}
                    </ThemedText>
                )}
                <Button
                    label="Review block"
                    disabled={!!problem}
                    onPress={() => setDialog('review')}
                    style={styles.save}
                />
            </ScrollView>

            <Dialog
                visible={dialog === 'review'}
                onClose={() => setDialog(null)}
                icon="Ban"
                title={`Block ${targetLabel}?`}
                message={
                    <View>
                        <KeyValueRow label="Days" value={describeDays(daysText)} />
                        <KeyValueRow label="Hours" value={timeText === ALL_DAY ? 'All day' : timeText} />
                    </View>
                }
                actions={confirmActions(() => setDialog(null), 'Block', save)}
            />
            <ErrorPopup {...ERRORS.saveFailed} visible={dialog === 'error'} onClose={() => setDialog(null)} />
        </BaseScreen>
    );
};

const styles = StyleSheet.create({
    scroll: {
        paddingBottom: spacing.xl,
    },
    flex: {
        flex: 1,
    },
    siteCard: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: spacing.xs,
    },
    leading: {
        marginRight: spacing.md - 4,
    },
    chips: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginHorizontal: gutter,
        marginTop: spacing.xs,
    },
    cardFoot: {
        marginTop: spacing.sm,
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
        marginHorizontal: gutter,
    },
    save: {
        marginHorizontal: gutter,
        marginTop: spacing.md,
    },
});

export default ScheduleScreen;
