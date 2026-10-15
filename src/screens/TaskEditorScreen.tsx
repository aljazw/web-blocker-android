import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { Habit, HabitLink, OneOffTask, RootStackNavigation, RootStackParamList } from '../types/types';
import BackButton from '../components/BackButton';
import TextField from '../components/TextField';
import BaseScreen from '../components/BaseScreen';
import Button from '../components/Button';
import Card from '../components/Card';
import Chip from '../components/Chip';
import ChipGroup from '../components/ChipGroup';
import DayPicker from '../components/DayPicker';
import DurationPicker from '../components/DurationPicker';
import Dialog, { confirmActions } from '../components/Dialog';
import ErrorPopup from '../components/ErrorPopup';
import { IconName } from '../components/Icon';
import IconButton from '../components/IconButton';
import IconPicker from '../components/IconPicker';
import SectionHeader from '../components/SectionHeader';
import Segmented from '../components/Segmented';
import StatRow from '../components/StatRow';
import StatTile from '../components/StatTile';
import { ThemedText } from '../components/ThemedText';
import { FadeIn, animateLayout } from '../components/Motion';
import { persistHabit, removeHabit } from '../hooks/useHabits';
import { gutter, spacing } from '../theme';
import { bestStreak, currentStreak, fromDateKey, newHabitId, toDateKey } from '../utils/habits';
import { describeHabitDays } from '../utils/habitText';
import { DEFAULT_TASK_LENGTH, newTaskId } from '../utils/dayPlan';
import { promoteOneOff, removeOneOff, saveOneOff } from '../utils/planService';
import { ensureReminderPermission } from '../utils/habitReminders';
import { getDay, getHabits, MAX_TASK_MINUTES } from '../storage';
import { haptics } from '../utils/haptics';
import { ERRORS } from '../constants/strings';
import { DEFAULT_HABIT_ICON, HABIT_ICONS } from '../constants/habitIcons';
import { DAY_PRESETS, EVERY_DAY, sameDays } from '../constants/days';

const SUGGESTIONS: { title: string; icon: IconName; duration: number; link?: HabitLink }[] = [
    { title: 'Breakfast', icon: 'Meal', duration: 30 },
    { title: 'Lunch', icon: 'Meal', duration: 45 },
    { title: 'Dinner', icon: 'Meal', duration: 45 },
    { title: 'Work', icon: 'Work', duration: 240 },
    { title: 'Deep work', icon: 'Work', duration: 120 },
    { title: 'Study', icon: 'Study', duration: 90 },
    { title: 'Workout', icon: 'Dumbbell', duration: 60, link: 'workout' },
    { title: 'Apnea training', icon: 'Waves', duration: 30, link: 'apnea' },
    { title: 'Walk', icon: 'Footprints', duration: 30 },
    { title: 'Read', icon: 'Book', duration: 30 },
    { title: 'Meditate', icon: 'Brain', duration: 10 },
    { title: 'Commute', icon: 'Commute', duration: 30 },
    { title: 'Chores', icon: 'House', duration: 30 },
    { title: 'Errands', icon: 'Errand', duration: 60 },
    { title: 'Rest', icon: 'Rest', duration: 30 },
    { title: 'Wind down', icon: 'Bed', duration: 30 },
    { title: 'Sleep', icon: 'Moon', duration: 480 },
];

const LENGTHS = [10, 15, 30, 45, 60, 90, 120, 180];

const LINKS: { value: HabitLink | 'none'; label: string }[] = [
    { value: 'none', label: 'Myself' },
    { value: 'workout', label: 'Workout' },
    { value: 'apnea', label: 'Apnea' },
];

const LINK_DESCRIPTION: Record<HabitLink | 'none', string> = {
    none: 'You check it off yourself.',
    workout: 'Checked off when you finish any workout that day.',
    apnea: 'Checked off when you finish any apnea session that day.',
};

const MAX_TITLE = 60;

/** How often the task happens: only on the day it was added from, or on weekdays. */
type Repeat = { kind: 'once' } | { kind: 'days'; days: boolean[] };

type Popup = { kind: 'delete' } | { kind: 'error' };

const TaskEditorScreen: React.FC = () => {
    const navigation = useNavigation<RootStackNavigation>();
    const { params } = useRoute<RouteProp<RootStackParamList, 'TaskEditor'>>();
    const { habitId, date, taskId } = params ?? {};

    const [habit, setHabit] = useState<Habit | null>(null);
    const [oneOff, setOneOff] = useState<OneOffTask | null>(null);
    const [finished, setFinished] = useState(false);
    const [title, setTitle] = useState('');
    const [icon, setIcon] = useState<IconName>(DEFAULT_HABIT_ICON);
    const [duration, setDuration] = useState(DEFAULT_TASK_LENGTH);
    const [repeat, setRepeat] = useState<Repeat>(date ? { kind: 'once' } : { kind: 'days', days: EVERY_DAY });
    const [custom, setCustom] = useState(false);
    const [link, setLink] = useState<HabitLink | 'none'>('none');
    const [popup, setPopup] = useState<Popup | null>(null);

    // Editing: load the task once. If it no longer exists, leave.
    useEffect(() => {
        if (habitId) {
            getHabits()
                .then(habits => {
                    const found = habits.find(h => h.id === habitId);
                    if (!found) {
                        navigation.goBack();
                        return;
                    }
                    setHabit(found);
                    setTitle(found.title);
                    setIcon(found.icon);
                    setDuration(found.duration);
                    setRepeat({ kind: 'days', days: found.days });
                    setCustom(!DAY_PRESETS.some(p => sameDays(p.days, found.days)));
                    setLink(found.link ?? 'none');
                })
                .catch(() => setPopup({ kind: 'error' }));
        } else if (date && taskId) {
            getDay(date)
                .then(day => {
                    const found = day.oneOffs.find(t => t.id === taskId);
                    if (!found) {
                        navigation.goBack();
                        return;
                    }
                    setOneOff(found);
                    setFinished(day.finished[found.id] !== undefined);
                    setTitle(found.title);
                    setIcon(found.icon);
                    setDuration(found.duration);
                })
                .catch(() => setPopup({ kind: 'error' }));
        }
    }, [date, habitId, navigation, taskId]);

    const trimmed = title.trim();
    const editing = !!habit || !!oneOff;
    const dayName = date
        ? date === toDateKey(new Date())
            ? 'today'
            : fromDateKey(date).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })
        : '';
    const problem = !trimmed
        ? 'Give the task a name.'
        : repeat.kind === 'days' && !repeat.days.some(Boolean)
        ? 'Pick at least one day.'
        : null;

    const pickSuggestion = (s: (typeof SUGGESTIONS)[number]) => {
        setTitle(s.title);
        setIcon(s.icon);
        setDuration(s.duration);
        setLink(s.link ?? 'none');
    };

    const pickDays = (days: boolean[] | null) => {
        animateLayout();
        setCustom(days === null);
        setRepeat({ kind: 'days', days: days ?? (repeat.kind === 'days' ? repeat.days : EVERY_DAY) });
    };

    const save = async () => {
        if (problem) {
            return;
        }
        let ok: boolean;
        if (repeat.kind === 'days') {
            const today = toDateKey(new Date());
            // A one-off that joins the routine keeps its id, so its place and check-off on that day stay.
            const base = habit ?? {
                id: oneOff?.id ?? newHabitId(),
                createdAt: date && date < today ? date : today,
                completions: oneOff && finished && date ? [date] : [],
            };
            ok = await persistHabit({
                id: base.id,
                createdAt: base.createdAt,
                completions: base.completions,
                title: trimmed,
                icon,
                days: repeat.days,
                duration,
                ...(link !== 'none' ? { link } : {}),
            });
            if (ok && oneOff && date) {
                ok = await promoteOneOff(date, oneOff.id);
            }
        } else {
            const task: OneOffTask = { id: oneOff?.id ?? newTaskId(), title: trimmed, icon, duration };
            ok = await saveOneOff(date!, task, !oneOff && date === toDateKey(new Date()));
        }
        if (!ok) {
            setPopup({ kind: 'error' });
            return;
        }
        haptics.success();
        navigation.goBack();
        // Asked after saving: the request can wait on a system dialog, which must never hold up the save.
        ensureReminderPermission();
    };

    const confirmDelete = async () => {
        const ok = habit ? await removeHabit(habit.id) : oneOff && date ? await removeOneOff(date, oneOff.id) : false;
        if (ok) {
            navigation.goBack();
        } else {
            setPopup({ kind: 'error' });
        }
    };

    return (
        <BaseScreen
            title={editing ? 'Edit task' : 'New task'}
            subtitle={habit ? 'Part of your routine' : date ? `For ${dayName}` : 'Part of your routine'}
            headerLeft={<BackButton />}
            headerRight={
                editing ? (
                    <IconButton
                        icon="Trash"
                        variant="outline"
                        accessibilityLabel="Delete task"
                        onPress={() => setPopup({ kind: 'delete' })}
                    />
                ) : undefined
            }>
            <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
                {habit && (
                    <FadeIn>
                        <StatRow>
                            <StatTile label="Streak" value={currentStreak(habit)} suffix=" d" />
                            <StatTile label="Best" value={bestStreak(habit)} suffix=" d" />
                            <StatTile label="Times done" value={habit.completions.length} />
                        </StatRow>
                    </FadeIn>
                )}

                <SectionHeader title="What" />
                <TextField
                    value={title}
                    onChangeText={setTitle}
                    placeholder="e.g. Lunch, Workout, Read"
                    maxLength={MAX_TITLE}
                />
                {!editing && (
                    <ChipGroup>
                        {SUGGESTIONS.map(s => (
                            <Chip
                                key={s.title}
                                icon={s.icon}
                                label={s.title}
                                selected={trimmed === s.title}
                                onPress={() => pickSuggestion(s)}
                            />
                        ))}
                    </ChipGroup>
                )}

                <SectionHeader title="How long" />
                <Card>
                    <DurationPicker
                        value={duration}
                        onChange={setDuration}
                        min={5}
                        max={MAX_TASK_MINUTES}
                        presets={LENGTHS}
                        accessibilityLabel="Duration"
                    />
                </Card>

                <SectionHeader title="Repeats" />
                <ChipGroup>
                    {date && !habit && (
                        <Chip
                            label={`Only ${dayName === 'today' ? 'today' : 'this day'}`}
                            selected={repeat.kind === 'once'}
                            onPress={() => {
                                animateLayout();
                                setRepeat({ kind: 'once' });
                            }}
                        />
                    )}
                    {DAY_PRESETS.map(preset => (
                        <Chip
                            key={preset.label}
                            label={preset.label}
                            selected={repeat.kind === 'days' && !custom && sameDays(repeat.days, preset.days)}
                            onPress={() => pickDays(preset.days)}
                        />
                    ))}
                    <Chip
                        label="Pick days"
                        selected={repeat.kind === 'days' && custom}
                        onPress={() => pickDays(null)}
                    />
                </ChipGroup>
                {repeat.kind === 'days' && custom && (
                    <Card>
                        <DayPicker value={repeat.days} onChange={days => setRepeat({ kind: 'days', days })} />
                    </Card>
                )}
                <ThemedText size="small" color="muted" style={styles.note}>
                    {repeat.kind === 'once'
                        ? `Just for ${dayName}. It won’t come back.`
                        : `${describeHabitDays(
                              repeat.days,
                          )}. It’s in your plan on these days, and missing it ends its streak.`}
                </ThemedText>

                <SectionHeader title="Icon" />
                <IconPicker icons={HABIT_ICONS} value={icon} onChange={setIcon} />

                {repeat.kind === 'days' && (
                    <>
                        <SectionHeader title="Checked off by" />
                        <View style={styles.linkPicker}>
                            <Segmented options={LINKS} value={link} onChange={setLink} />
                            <ThemedText size="small" color="muted" style={styles.linkHint}>
                                {LINK_DESCRIPTION[link]}
                            </ThemedText>
                        </View>
                    </>
                )}

                {problem && trimmed.length > 0 && (
                    <ThemedText size="small" color="primaryRed" style={styles.problem}>
                        {problem}
                    </ThemedText>
                )}
                <Button
                    label={editing ? 'Save changes' : 'Add task'}
                    disabled={!!problem}
                    onPress={save}
                    style={styles.save}
                />
            </ScrollView>

            <Dialog
                visible={popup?.kind === 'delete'}
                onClose={() => setPopup(null)}
                icon="Trash"
                tone="danger"
                title={`Delete “${habit?.title ?? oneOff?.title ?? ''}”?`}
                message={
                    habit
                        ? 'It leaves your routine on every day, and its streak and history are removed.'
                        : `It leaves the plan for ${dayName}.`
                }
                actions={confirmActions(() => setPopup(null), 'Delete', confirmDelete, true)}
            />
            <ErrorPopup {...ERRORS.saveFailed} visible={popup?.kind === 'error'} onClose={() => setPopup(null)} />
        </BaseScreen>
    );
};

const styles = StyleSheet.create({
    scroll: {
        paddingBottom: spacing.xl,
    },
    note: {
        marginHorizontal: gutter + 2,
        marginTop: spacing.xs,
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

export default TaskEditorScreen;
