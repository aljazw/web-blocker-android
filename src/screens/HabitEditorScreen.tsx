import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Switch, TextInput, View } from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { Habit, RootStackNavigation, RootStackParamList } from '../types/types';
import ActionButton from '../components/ActionButton';
import BackButton from '../components/BackButton';
import BaseScreen from '../components/BaseScreen';
import BlurModal from '../components/BlurModal';
import Button from '../components/Button';
import Chip from '../components/Chip';
import DayPicker from '../components/DayPicker';
import ErrorPopup from '../components/ErrorPopup';
import SectionHeader from '../components/SectionHeader';
import StatTile from '../components/StatTile';
import TimeInput from '../components/TimeInput';
import { ThemedText } from '../components/ThemedText';
import { ThemedView } from '../components/ThemedView';
import { FadeIn, animateLayout } from '../components/Motion';
import { useTheme } from '../context/ThemeContext';
import { persistHabit, removeHabit } from '../hooks/useHabits';
import { shapes, spacing } from '../theme';
import { bestStreak, currentStreak, newHabitId, toDateKey } from '../utils/habits';
import { describeHabitDays } from '../utils/habitText';
import { ensureReminderPermission } from '../utils/habitReminders';
import { getHabits } from '../utils/storage';
import { haptics } from '../utils/haptics';
import { ERRORS } from '../constants/strings';

const SUGGESTIONS = [
    { emoji: '💪', title: 'Workout 10 min' },
    { emoji: '📚', title: 'Read 10 pages' },
    { emoji: '🧘', title: 'Meditate 5 min' },
    { emoji: '💧', title: 'Drink 8 glasses of water' },
    { emoji: '✍️', title: 'Write in my journal' },
    { emoji: '🚶', title: 'Walk 5,000 steps' },
    { emoji: '📵', title: 'No phone first hour' },
    { emoji: '🛏️', title: 'In bed by 23:00' },
];

const EMOJIS = ['💪', '📚', '🧘', '💧', '✍️', '🚶', '🏃', '📵', '🛏️', '🥗', '🎯', '🎸', '💻', '🧹', '🌱', '☀️'];

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
    const [emoji, setEmoji] = useState(EMOJIS[0]);
    const [days, setDays] = useState<boolean[]>(EVERY_DAY);
    const [reminderOn, setReminderOn] = useState(false);
    const [hour, setHour] = useState('08');
    const [minute, setMinute] = useState('00');
    const [dialog, setDialog] = useState<Dialog | null>(null);

    // Editing: load the habit once. If it no longer exists, leave.
    useEffect(() => {
        if (!habitId) return;
        getHabits()
            .then(habits => {
                const habit = habits.find(h => h.id === habitId);
                if (!habit) {
                    navigation.goBack();
                    return;
                }
                setExisting(habit);
                setTitle(habit.title);
                setEmoji(habit.emoji);
                setDays(habit.days);
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
    const hourNum = parseInt(hour, 10);
    const minuteNum = parseInt(minute, 10);
    const reminderValid = !reminderOn || (hour.length > 0 && minute.length > 0 && hourNum <= 23 && minuteNum <= 59);
    const problem = !trimmed
        ? 'Give your habit a name.'
        : !days.some(Boolean)
        ? 'Pick at least one day.'
        : !reminderValid
        ? 'Enter a valid reminder time.'
        : null;

    const save = async () => {
        if (problem) return;
        const reminder = reminderOn ? `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}` : null;
        const habit: Habit = existing
            ? { ...existing, title: trimmed, emoji, days, reminder }
            : {
                  id: newHabitId(),
                  title: trimmed,
                  emoji,
                  days,
                  reminder,
                  createdAt: toDateKey(new Date()),
                  completions: [],
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
        if (!existing) return;
        if (await removeHabit(existing.id)) {
            navigation.goBack();
        } else {
            setDialog({ kind: 'error' });
        }
    };

    return (
        <BaseScreen
            title={existing ? 'Edit habit' : 'New habit'}
            subtitle={existing ? 'Changes keep your streak history' : 'Small and daily beats big and rare'}
            headerLeft={<BackButton />}>
            <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
                {existing && (
                    <FadeIn style={styles.statsRow}>
                        <StatTile label="Current streak" value={currentStreak(existing)} suffix="🔥" />
                        <StatTile label="Best streak" value={bestStreak(existing)} />
                        <StatTile label="Check-ins" value={existing.completions.length} />
                    </FadeIn>
                )}

                <SectionHeader title="Habit" />
                <ThemedView withBorder style={styles.card}>
                    <View style={styles.titleRow}>
                        <View style={[styles.emojiTile, { backgroundColor: theme.colors.elevated }]}>
                            <ThemedText style={styles.emoji}>{emoji}</ThemedText>
                        </View>
                        <TextInput
                            value={title}
                            onChangeText={text => setTitle(text.slice(0, MAX_TITLE))}
                            placeholder="e.g. Workout 10 min"
                            placeholderTextColor={theme.colors.muted}
                            selectionColor={theme.colors.accent}
                            style={[styles.titleInput, { color: theme.colors.text, borderColor: theme.colors.border }]}
                            maxLength={MAX_TITLE}
                            returnKeyType="done"
                        />
                    </View>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.emojiRow}>
                        {EMOJIS.map(e => (
                            <Chip key={e} label={e} selected={e === emoji} onPress={() => setEmoji(e)} />
                        ))}
                    </ScrollView>
                </ThemedView>

                {!existing && (
                    <>
                        <SectionHeader title="Ideas" />
                        <View style={styles.chips}>
                            {SUGGESTIONS.map(s => (
                                <Chip
                                    key={s.title}
                                    label={`${s.emoji} ${s.title}`}
                                    selected={trimmed === s.title}
                                    onPress={() => {
                                        setTitle(s.title);
                                        setEmoji(s.emoji);
                                    }}
                                />
                            ))}
                        </View>
                    </>
                )}

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
                <ThemedView withBorder style={styles.card}>
                    <DayPicker value={days} onChange={setDays} />
                    <ThemedText size="small" color="muted" align="center" style={styles.cardFoot}>
                        {describeHabitDays(days)}
                    </ThemedText>
                </ThemedView>

                <SectionHeader title="Reminder" />
                <ThemedView withBorder style={styles.card}>
                    <View style={styles.reminderRow}>
                        <View style={styles.flex}>
                            <ThemedText weight="medium">Daily reminder</ThemedText>
                            <ThemedText size="small" color="muted">
                                A nudge on the days this habit is due
                            </ThemedText>
                        </View>
                        <Switch
                            value={reminderOn}
                            onValueChange={on => {
                                haptics.toggle();
                                animateLayout();
                                setReminderOn(on);
                            }}
                            trackColor={{ false: theme.colors.muted, true: theme.colors.accent }}
                            thumbColor="#FFFFFF"
                        />
                    </View>
                    {reminderOn && (
                        <View style={styles.timeRow}>
                            <TimeInput
                                label="At"
                                hourValue={hour}
                                minutesValue={minute}
                                setHour={setHour}
                                setMinutes={setMinute}
                            />
                        </View>
                    )}
                </ThemedView>

                {problem && trimmed.length > 0 && (
                    <ThemedText size="small" color="primaryRed" align="center" style={styles.problem}>
                        {problem}
                    </ThemedText>
                )}
                <Button
                    label={existing ? 'Save changes' : 'Create habit'}
                    icon="Check"
                    disabled={!!problem}
                    onPress={save}
                    style={styles.save}
                />
                {existing && (
                    <Button
                        label="Delete habit"
                        variant="ghost"
                        onPress={() => setDialog({ kind: 'delete' })}
                        style={styles.delete}
                    />
                )}
            </ScrollView>

            <BlurModal visible={dialog?.kind === 'delete'} onClose={() => setDialog(null)}>
                <ThemedText size="large" weight="strong" align="center">
                    Delete “{existing?.title}”?
                </ThemedText>
                <ThemedText color="muted" align="center" style={styles.dialogText}>
                    Its streak and history will be gone for good.
                </ThemedText>
                <View style={styles.dialogButtons}>
                    <ActionButton variant="cancel" onPress={() => setDialog(null)} />
                    <ActionButton variant="confirm" label="Delete" onPress={confirmDelete} />
                </View>
            </BlurModal>

            <BlurModal visible={dialog?.kind === 'notificationsOff'} onClose={() => navigation.goBack()}>
                <ThemedText size="large" weight="strong" align="center">
                    Habit saved
                </ThemedText>
                <ThemedText color="muted" align="center" style={styles.dialogText}>
                    Notifications are turned off for SiteLock, so reminders can’t appear. You can allow them in your
                    phone’s settings.
                </ThemedText>
                <Button label="OK" compact onPress={() => navigation.goBack()} style={styles.okButton} />
            </BlurModal>

            <ErrorPopup {...ERRORS.saveFailed} visible={dialog?.kind === 'error'} onClose={() => setDialog(null)} />
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
    statsRow: {
        flexDirection: 'row',
        marginHorizontal: spacing.md - 4,
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
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    emojiTile: {
        width: 52,
        height: 52,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: spacing.sm + 2,
    },
    emoji: {
        fontSize: 26,
        lineHeight: 32,
    },
    titleInput: {
        flex: 1,
        height: 52,
        borderWidth: 1,
        borderRadius: shapes.borderRadius.medium,
        paddingHorizontal: spacing.md,
        fontSize: 16,
    },
    emojiRow: {
        marginTop: spacing.md,
    },
    chips: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginHorizontal: spacing.md,
        marginTop: spacing.xs,
    },
    reminderRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    timeRow: {
        flexDirection: 'row',
        marginTop: spacing.md,
        width: '55%',
    },
    problem: {
        marginTop: spacing.lg,
        marginHorizontal: spacing.md,
    },
    save: {
        marginHorizontal: spacing.md,
        marginTop: spacing.lg,
    },
    delete: {
        marginHorizontal: spacing.md,
        marginTop: spacing.sm,
    },
    dialogText: {
        marginTop: spacing.sm,
    },
    dialogButtons: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginTop: spacing.lg,
    },
    okButton: {
        alignSelf: 'stretch',
        marginTop: spacing.lg,
    },
});

export default HabitEditorScreen;
