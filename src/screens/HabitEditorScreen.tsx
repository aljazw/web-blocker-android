import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { Habit, HabitLink, RootStackNavigation, RootStackParamList } from '../types/types';
import BackButton from '../components/BackButton';
import TextField from '../components/TextField';
import BaseScreen from '../components/BaseScreen';
import Button from '../components/Button';
import Card from '../components/Card';
import Chip from '../components/Chip';
import ChipGroup from '../components/ChipGroup';
import DayPicker from '../components/DayPicker';
import Dialog, { confirmActions } from '../components/Dialog';
import ErrorPopup from '../components/ErrorPopup';
import { IconName } from '../components/Icon';
import IconButton from '../components/IconButton';
import IconPicker from '../components/IconPicker';
import { ListGroup, ListRow, Toggle } from '../components/ListGroup';
import SectionHeader from '../components/SectionHeader';
import Segmented from '../components/Segmented';
import StatRow from '../components/StatRow';
import StatTile from '../components/StatTile';
import TimeInput from '../components/TimeInput';
import { ThemedText } from '../components/ThemedText';
import { FadeIn, animateLayout } from '../components/Motion';
import { persistHabit, removeHabit } from '../hooks/useHabits';
import { gutter, spacing } from '../theme';
import { bestStreak, currentStreak, newHabitId, toDateKey } from '../utils/habits';
import { describeHabitDays } from '../utils/habitText';
import { ensureReminderPermission } from '../utils/habitReminders';
import { getHabits } from '../storage';
import { haptics } from '../utils/haptics';
import { ERRORS } from '../constants/strings';
import { DEFAULT_HABIT_ICON, HABIT_ICONS } from '../constants/habitIcons';
import { DAY_PRESETS, EVERY_DAY, sameDays } from '../constants/days';

const SUGGESTIONS: { icon: IconName; title: string; link?: HabitLink }[] = [
    { icon: 'Dumbbell', title: 'Workout', link: 'workout' },
    { icon: 'Book', title: 'Read 10 pages' },
    { icon: 'Waves', title: 'Apnea training', link: 'apnea' },
    { icon: 'Brain', title: 'Meditate 5 min' },
    { icon: 'Droplet', title: 'Drink 2 L of water' },
    { icon: 'Footprints', title: 'Walk 8,000 steps' },
    { icon: 'PhoneOff', title: 'No phone first hour' },
    { icon: 'Bed', title: 'In bed by 23:00' },
];

const LINKS: { value: HabitLink | 'none'; label: string }[] = [
    { value: 'none', label: 'Manual' },
    { value: 'workout', label: 'Workout' },
    { value: 'apnea', label: 'Apnea' },
];

const LINK_DESCRIPTION: Record<HabitLink | 'none', string> = {
    none: 'You check it off yourself.',
    workout: 'Checked off when you reach the end of any workout that day.',
    apnea: 'Checked off when you finish any apnea session that day.',
};


const MAX_TITLE = 60;

type Dialog = { kind: 'delete' } | { kind: 'notificationsOff' } | { kind: 'error' };

const HabitEditorScreen: React.FC = () => {
    const navigation = useNavigation<RootStackNavigation>();
    const { params } = useRoute<RouteProp<RootStackParamList, 'HabitEditor'>>();
    const habitId = params?.habitId;

    const [existing, setExisting] = useState<Habit | null>(null);
    const [title, setTitle] = useState('');
    const [icon, setIcon] = useState<IconName>(DEFAULT_HABIT_ICON);
    const [days, setDays] = useState<boolean[]>(EVERY_DAY);
    const [reminderOn, setReminderOn] = useState(false);
    const [link, setLink] = useState<HabitLink | 'none'>('none');
    const [hour, setHour] = useState('08');
    const [minute, setMinute] = useState('00');
    const [dialog, setDialog] = useState<Dialog | null>(null);

    // Editing: load the habit once. If it no longer exists, leave.
    useEffect(() => {
        if (!habitId) {
            return;
        }
        getHabits()
            .then(habits => {
                const habit = habits.find(h => h.id === habitId);
                if (!habit) {
                    navigation.goBack();
                    return;
                }
                setExisting(habit);
                setTitle(habit.title);
                setIcon(habit.icon);
                setDays(habit.days);
                setLink(habit.link ?? 'none');
                if (habit.reminder) {
                    const [h, m] = habit.reminder.split(':');
                    setReminderOn(true);
                    setHour(h);
                    setMinute(m);
                }
            })
            .catch(() => setDialog({ kind: 'error' }));
    }, [habitId, navigation]);

    const trimmed = title.trim();
    const reminderValid =
        !reminderOn || (hour.length > 0 && minute.length > 0 && Number(hour) <= 23 && Number(minute) <= 59);
    const problem = !trimmed
        ? 'Give your habit a name.'
        : !days.some(Boolean)
        ? 'Pick at least one day.'
        : !reminderValid
        ? 'Enter a valid reminder time.'
        : null;

    const save = async () => {
        if (problem) {
            return;
        }
        const reminder = reminderOn ? `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}` : null;
        const base = existing ?? { id: newHabitId(), createdAt: toDateKey(new Date()), completions: [] };
        const habit: Habit = {
            id: base.id,
            createdAt: base.createdAt,
            completions: base.completions,
            title: trimmed,
            icon,
            days,
            reminder,
            ...(link !== 'none' ? { link } : {}),
        };

        const granted = reminder ? await ensureReminderPermission() : true;
        if (!(await persistHabit(habit))) {
            setDialog({ kind: 'error' });
            return;
        }
        haptics.success();
        if (!granted) {
            setDialog({ kind: 'notificationsOff' });
            return;
        }
        navigation.goBack();
    };

    const confirmDelete = async () => {
        if (!existing) {
            return;
        }
        if (await removeHabit(existing.id)) {
            navigation.goBack();
        } else {
            setDialog({ kind: 'error' });
        }
    };

    return (
        <BaseScreen
            title={existing ? 'Edit habit' : 'New habit'}
            subtitle={existing ? 'Changes keep your history' : 'Small and daily beats big and rare'}
            headerLeft={<BackButton />}
            headerRight={
                existing ? (
                    <IconButton
                        icon="Trash"
                        variant="outline"
                        accessibilityLabel="Delete habit"
                        onPress={() => setDialog({ kind: 'delete' })}
                    />
                ) : undefined
            }>
            <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
                {existing && (
                    <FadeIn>
                        <StatRow>
                            <StatTile label="Current" value={currentStreak(existing)} suffix=" d" />
                            <StatTile label="Best" value={bestStreak(existing)} suffix=" d" />
                            <StatTile label="Check-ins" value={existing.completions.length} />
                        </StatRow>
                    </FadeIn>
                )}

                <SectionHeader title="Name" />
                <TextField
                    value={title}
                    onChangeText={setTitle}
                    placeholder="e.g. Workout 10 min"
                    maxLength={MAX_TITLE}
                />

                {!existing && (
                    <ChipGroup>
                        {SUGGESTIONS.map(s => (
                            <Chip
                                key={s.title}
                                icon={s.icon}
                                label={s.title}
                                selected={trimmed === s.title}
                                onPress={() => {
                                    setTitle(s.title);
                                    setIcon(s.icon);
                                    setLink(s.link ?? 'none');
                                }}
                            />
                        ))}
                    </ChipGroup>
                )}

                <SectionHeader title="Icon" />
                <IconPicker icons={HABIT_ICONS} value={icon} onChange={setIcon} />

                <SectionHeader title="Days" />
                <ChipGroup>
                    {DAY_PRESETS.map(preset => (
                        <Chip
                            key={preset.label}
                            label={preset.label}
                            selected={sameDays(days, preset.days)}
                            onPress={() => setDays(preset.days)}
                        />
                    ))}
                </ChipGroup>
                <Card>
                    <DayPicker value={days} onChange={setDays} />
                    <ThemedText size="small" color="muted" align="center" style={styles.cardFoot}>
                        {describeHabitDays(days)}
                    </ThemedText>
                </Card>

                <SectionHeader title="Automation" />
                <View style={styles.linkPicker}>
                    <Segmented options={LINKS} value={link} onChange={setLink} />
                    <ThemedText size="small" color="muted" style={styles.linkHint}>
                        {LINK_DESCRIPTION[link]}
                    </ThemedText>
                </View>

                <SectionHeader title="Reminder" />
                <ListGroup>
                    <ListRow icon="Bell" title="Daily reminder" description="A notification on the days it's due">
                        <Toggle
                            value={reminderOn}
                            onValueChange={on => {
                                animateLayout();
                                setReminderOn(on);
                            }}
                        />
                    </ListRow>
                    {reminderOn && (
                        <View style={styles.timeRow}>
                            <TimeInput
                                label="Time"
                                hourValue={hour}
                                minutesValue={minute}
                                setHour={setHour}
                                setMinutes={setMinute}
                            />
                        </View>
                    )}
                </ListGroup>

                {problem && trimmed.length > 0 && (
                    <ThemedText size="small" color="primaryRed" style={styles.problem}>
                        {problem}
                    </ThemedText>
                )}
                <Button
                    label={existing ? 'Save changes' : 'Create habit'}
                    disabled={!!problem}
                    onPress={save}
                    style={styles.save}
                />
            </ScrollView>

            <Dialog
                visible={dialog?.kind === 'delete'}
                onClose={() => setDialog(null)}
                icon="Trash"
                tone="danger"
                title={`Delete “${existing?.title ?? ''}”?`}
                message="Its streak and history will be removed permanently."
                actions={confirmActions(() => setDialog(null), 'Delete', confirmDelete, true)}
            />
            <Dialog
                visible={dialog?.kind === 'notificationsOff'}
                onClose={() => navigation.goBack()}
                icon="Bell"
                title="Habit saved"
                message="Notifications are off for Gaman, so reminders can't appear. You can allow them in your phone's settings."
                actions={[{ label: 'OK', onPress: () => navigation.goBack() }]}
            />
            <ErrorPopup {...ERRORS.saveFailed} visible={dialog?.kind === 'error'} onClose={() => setDialog(null)} />
        </BaseScreen>
    );
};

const styles = StyleSheet.create({
    scroll: {
        paddingBottom: spacing.xl,
    },
    cardFoot: {
        marginTop: spacing.sm,
    },
    timeRow: {
        flexDirection: 'row',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.md,
        width: '62%',
    },
    linkPicker: {
        marginHorizontal: gutter,
    },
    linkHint: {
        marginTop: spacing.sm,
        marginHorizontal: 2,
    },
    problem: {
        marginTop: spacing.lg,
        marginHorizontal: gutter + 2,
    },
    save: {
        marginHorizontal: gutter,
        marginTop: spacing.lg,
    },
});

export default HabitEditorScreen;
