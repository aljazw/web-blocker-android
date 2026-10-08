import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { Habit, RootStackNavigation, RootStackParamList } from '../types/types';
import BackButton from '../components/BackButton';
import BaseScreen from '../components/BaseScreen';
import Button from '../components/Button';
import Card from '../components/Card';
import Chip from '../components/Chip';
import DayPicker from '../components/DayPicker';
import Dialog, { confirmActions } from '../components/Dialog';
import ErrorPopup from '../components/ErrorPopup';
import Icon, { IconName } from '../components/Icon';
import IconButton from '../components/IconButton';
import { ListGroup, ListRow, Toggle } from '../components/ListGroup';
import SectionHeader from '../components/SectionHeader';
import StatRow from '../components/StatRow';
import StatTile from '../components/StatTile';
import TimeInput from '../components/TimeInput';
import { ThemedText } from '../components/ThemedText';
import { FadeIn, animateLayout } from '../components/Motion';
import { useTheme } from '../context/ThemeContext';
import { persistHabit, removeHabit } from '../hooks/useHabits';
import { gutter, shapes, spacing } from '../theme';
import { bestStreak, currentStreak, newHabitId, toDateKey } from '../utils/habits';
import { describeHabitDays } from '../utils/habitText';
import { ensureReminderPermission } from '../utils/habitReminders';
import { getHabits } from '../utils/storage';
import { haptics } from '../utils/haptics';
import { ERRORS } from '../constants/strings';
import { DEFAULT_HABIT_ICON, HABIT_ICONS } from '../constants/habitIcons';

const SUGGESTIONS: { icon: IconName; title: string }[] = [
    { icon: 'Dumbbell', title: 'Workout 10 min' },
    { icon: 'Book', title: 'Read 10 pages' },
    { icon: 'Waves', title: 'Apnea training' },
    { icon: 'Brain', title: 'Meditate 5 min' },
    { icon: 'Droplet', title: 'Drink 2 L of water' },
    { icon: 'Footprints', title: 'Walk 8,000 steps' },
    { icon: 'PhoneOff', title: 'No phone first hour' },
    { icon: 'Bed', title: 'In bed by 23:00' },
];

const EVERY_DAY = [true, true, true, true, true, true, true];
const DAY_PRESETS = [
    { label: 'Every day', days: EVERY_DAY },
    { label: 'Weekdays', days: [true, true, true, true, true, false, false] },
    { label: 'Weekends', days: [false, false, false, false, false, true, true] },
];

const MAX_TITLE = 60;
const sameDays = (a: boolean[], b: boolean[]) => a.every((v, i) => v === b[i]);

type Dialog = { kind: 'delete' } | { kind: 'notificationsOff' } | { kind: 'error' };

const HabitEditorScreen: React.FC = () => {
    const { theme } = useTheme();
    const navigation = useNavigation<RootStackNavigation>();
    const { params } = useRoute<RouteProp<RootStackParamList, 'HabitEditor'>>();
    const habitId = params?.habitId;

    const [existing, setExisting] = useState<Habit | null>(null);
    const [title, setTitle] = useState('');
    const [icon, setIcon] = useState<IconName>(DEFAULT_HABIT_ICON);
    const [days, setDays] = useState<boolean[]>(EVERY_DAY);
    const [reminderOn, setReminderOn] = useState(false);
    const [linkApnea, setLinkApnea] = useState(false);
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
                setLinkApnea(habit.link === 'apnea');
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
            ...(linkApnea ? { link: 'apnea' as const } : {}),
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
                <TextInput
                    value={title}
                    onChangeText={text => setTitle(text.slice(0, MAX_TITLE))}
                    placeholder="e.g. Workout 10 min"
                    placeholderTextColor={theme.colors.muted}
                    selectionColor={theme.colors.accent}
                    style={[
                        styles.titleInput,
                        {
                            color: theme.colors.text,
                            borderColor: theme.colors.border,
                            backgroundColor: theme.colors.card,
                        },
                    ]}
                    maxLength={MAX_TITLE}
                    returnKeyType="done"
                />

                {!existing && (
                    <View style={styles.chips}>
                        {SUGGESTIONS.map(s => (
                            <Chip
                                key={s.title}
                                icon={s.icon}
                                label={s.title}
                                selected={trimmed === s.title}
                                onPress={() => {
                                    setTitle(s.title);
                                    setIcon(s.icon);
                                    setLinkApnea(s.icon === 'Waves');
                                }}
                            />
                        ))}
                    </View>
                )}

                <SectionHeader title="Icon" />
                <Card style={styles.iconGrid}>
                    {HABIT_ICONS.map(name => {
                        const selected = name === icon;
                        return (
                            <Pressable
                                key={name}
                                onPress={() => {
                                    haptics.tap();
                                    setIcon(name);
                                }}
                                accessibilityRole="radio"
                                accessibilityState={{ selected }}
                                accessibilityLabel={name}
                                style={[
                                    styles.iconCell,
                                    selected && {
                                        backgroundColor: theme.colors.accentSoft,
                                        borderColor: theme.colors.accent,
                                    },
                                ]}>
                                <Icon
                                    name={name}
                                    size={20}
                                    tint={selected ? theme.colors.accent : theme.colors.muted}
                                />
                            </Pressable>
                        );
                    })}
                </Card>

                <SectionHeader title="Days" />
                <View style={styles.chips}>
                    {DAY_PRESETS.map(preset => (
                        <Chip
                            key={preset.label}
                            label={preset.label}
                            selected={sameDays(days, preset.days)}
                            onPress={() => setDays(preset.days)}
                        />
                    ))}
                </View>
                <Card>
                    <DayPicker value={days} onChange={setDays} />
                    <ThemedText size="small" color="muted" align="center" style={styles.cardFoot}>
                        {describeHabitDays(days)}
                    </ThemedText>
                </Card>

                <SectionHeader title="Automation" />
                <ListGroup>
                    <ListRow
                        icon="Waves"
                        title="Complete with apnea training"
                        description="Checked off when you finish any apnea session that day">
                        <Toggle value={linkApnea} onValueChange={setLinkApnea} />
                    </ListRow>
                </ListGroup>

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
                message="Notifications are off for SiteLock, so reminders can't appear. You can allow them in your phone's settings."
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
    titleInput: {
        marginHorizontal: gutter,
        height: 48,
        borderWidth: 1,
        borderRadius: shapes.borderRadius.medium,
        paddingHorizontal: spacing.md,
        fontSize: 15,
    },
    chips: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginHorizontal: gutter,
        marginTop: spacing.sm,
    },
    iconGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        marginTop: 0,
        padding: spacing.sm,
    },
    iconCell: {
        width: '12.5%',
        aspectRatio: 1,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: shapes.borderRadius.medium,
        borderWidth: 1,
        borderColor: 'transparent',
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
