import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { DayPlan, Habit, PlanBlock, RootStackNavigation, RootStackParamList } from '../types/types';
import BackButton from '../components/BackButton';
import BaseScreen from '../components/BaseScreen';
import Button from '../components/Button';
import Card from '../components/Card';
import Chip from '../components/Chip';
import Dialog, { confirmActions } from '../components/Dialog';
import ErrorPopup from '../components/ErrorPopup';
import Icon, { IconName } from '../components/Icon';
import IconButton from '../components/IconButton';
import { ListGroup, ListRow, Toggle } from '../components/ListGroup';
import SectionHeader from '../components/SectionHeader';
import TimeInput from '../components/TimeInput';
import { ThemedText } from '../components/ThemedText';
import { useTheme } from '../context/ThemeContext';
import { gutter, shapes, spacing } from '../theme';
import { fromDateKey } from '../utils/dates';
import {
    DAY_MINUTES,
    DEFAULT_BLOCK_LENGTH,
    blockTimes,
    formatDuration,
    formatMinutes,
    newBlockId,
    visibleBlocks,
} from '../utils/dayPlan';
import { isScheduled } from '../utils/habits';
import { ensureReminderPermission } from '../utils/habitReminders';
import { loadDayPlan, removeBlock, upsertBlock } from '../utils/planService';
import { getHabits } from '../utils/storage';
import { haptics } from '../utils/haptics';
import { ERRORS } from '../constants/strings';

const SUGGESTIONS: { title: string; icon: IconName; length: number }[] = [
    { title: 'Breakfast', icon: 'Meal', length: 30 },
    { title: 'Lunch', icon: 'Meal', length: 45 },
    { title: 'Dinner', icon: 'Meal', length: 45 },
    { title: 'Snack', icon: 'Apple', length: 15 },
    { title: 'Workout', icon: 'Dumbbell', length: 60 },
    { title: 'Deep work', icon: 'Work', length: 120 },
    { title: 'Meetings', icon: 'Meeting', length: 60 },
    { title: 'Study', icon: 'Study', length: 90 },
    { title: 'Commute', icon: 'Commute', length: 30 },
    { title: 'Walk', icon: 'Footprints', length: 30 },
    { title: 'Read', icon: 'Book', length: 30 },
    { title: 'Errands', icon: 'Errand', length: 60 },
    { title: 'Chores', icon: 'House', length: 30 },
    { title: 'Wind down', icon: 'Bed', length: 45 },
];

const PLAN_ICONS: IconName[] = [
    'Meal',
    'Coffee',
    'Apple',
    'Droplet',
    'Work',
    'Meeting',
    'Study',
    'Code',
    'Dumbbell',
    'Footprints',
    'Waves',
    'Commute',
    'Errand',
    'House',
    'Book',
    'Pen',
    'Brain',
    'Music',
    'Leaf',
    'PhoneOff',
    'Sunrise',
    'Sun',
    'Bed',
    'Target',
];

const LENGTHS = [15, 30, 45, 60, 90, 120, 180];
const MAX_TITLE = 60;

const split = (minutes: number): [string, string] => {
    const [h, m] = formatMinutes(minutes % DAY_MINUTES).split(':');
    return [h, m];
};

/** "HH", "MM" -> minutes, or null while incomplete. */
const join = (h: string, m: string): number | null =>
    h.length && m.length && Number(h) <= 23 && Number(m) <= 59 ? Number(h) * 60 + Number(m) : null;

type Popup = { kind: 'delete' } | { kind: 'error' };

const PlanBlockEditorScreen: React.FC = () => {
    const { theme } = useTheme();
    const navigation = useNavigation<RootStackNavigation>();
    const { params } = useRoute<RouteProp<RootStackParamList, 'PlanBlockEditor'>>();
    const { date, blockId } = params;

    const initialStart = params.start ?? 8 * 60;
    const initialEnd = params.end ?? Math.min(DAY_MINUTES, initialStart + DEFAULT_BLOCK_LENGTH);

    const [plan, setPlan] = useState<DayPlan | null>(null);
    const [habits, setHabits] = useState<Habit[]>([]);
    const [existing, setExisting] = useState<PlanBlock | null>(null);
    const [title, setTitle] = useState('');
    const [icon, setIcon] = useState<IconName>('Target');
    const [habitId, setHabitId] = useState<string | undefined>(params.habitId);
    const [repeat, setRepeat] = useState(true);
    const [startH, setStartH] = useState(split(initialStart)[0]);
    const [startM, setStartM] = useState(split(initialStart)[1]);
    const [endH, setEndH] = useState(split(initialEnd)[0]);
    const [endM, setEndM] = useState(split(initialEnd)[1]);
    const [popup, setPopup] = useState<Popup | null>(null);

    useEffect(() => {
        Promise.all([loadDayPlan(date), getHabits()])
            .then(([loaded, allHabits]) => {
                setPlan(loaded.plan);
                setHabits(allHabits);
                const block = blockId ? loaded.plan.blocks.find(b => b.id === blockId) : undefined;
                if (blockId && !block) {
                    navigation.goBack();
                    return;
                }
                if (block) {
                    setExisting(block);
                    setTitle(block.title);
                    setIcon(block.icon);
                    setHabitId(block.habitId);
                    setRepeat(!block.once);
                    [block.start, block.end].forEach((value, i) => {
                        const [h, m] = split(value);
                        (i ? setEndH : setStartH)(h);
                        (i ? setEndM : setStartM)(m);
                    });
                } else if (params.habitId) {
                    const habit = allHabits.find(h => h.id === params.habitId);
                    if (habit) {
                        setTitle(habit.title);
                        setIcon(habit.icon);
                    }
                }
            })
            .catch(() => setPopup({ kind: 'error' }));
    }, [blockId, date, navigation, params.habitId]);

    const start = join(startH, startM);
    const rawEnd = join(endH, endM);
    // An end of 00:00 means midnight at the end of the day.
    const end = rawEnd === 0 ? DAY_MINUTES : rawEnd;
    const trimmed = title.trim();
    const day = fromDateKey(date);
    const dueHabits = habits.filter(h => isScheduled(h, day));
    const linked = habits.find(h => h.id === habitId);

    const problem = !trimmed
        ? 'Give the block a name.'
        : start === null || end === null
        ? 'Enter a valid start and end time.'
        : end <= start
        ? 'The block has to end after it starts. Blocks past midnight belong to the next day.'
        : null;

    const clashes =
        plan && start !== null && end !== null && end > start
            ? visibleBlocks(plan, habits).filter(b => b.id !== blockId && b.start < end && start < b.end)
            : [];

    const setLength = (length: number) => {
        if (start === null) {
            return;
        }
        const [h, m] = split(Math.min(DAY_MINUTES, start + length));
        setEndH(h);
        setEndM(m);
    };

    const pickSuggestion = (s: (typeof SUGGESTIONS)[number]) => {
        setTitle(s.title);
        setIcon(s.icon);
        setHabitId(undefined);
        if (!existing) {
            setLength(s.length);
        }
    };

    const pickHabit = (habit: Habit | null) => {
        if (!habit) {
            setHabitId(undefined);
            return;
        }
        setHabitId(habit.id);
        setTitle(habit.title);
        setIcon(habit.icon);
    };

    const save = async () => {
        if (problem || start === null || end === null) {
            return;
        }
        const block: PlanBlock = {
            id: existing?.id ?? newBlockId(),
            title: trimmed,
            icon,
            start,
            end,
            ...(habitId ? { habitId } : {}),
            ...(repeat ? {} : { once: true }),
            ...(existing?.done && !habitId ? { done: true } : {}),
        };
        await ensureReminderPermission();
        if (await upsertBlock(date, block)) {
            haptics.success();
            navigation.goBack();
        } else {
            setPopup({ kind: 'error' });
        }
    };

    const confirmDelete = async () => {
        if (existing && (await removeBlock(date, existing.id))) {
            navigation.goBack();
        } else {
            setPopup({ kind: 'error' });
        }
    };

    const dayName = day.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });

    return (
        <BaseScreen
            title={existing ? 'Edit block' : 'New block'}
            subtitle={dayName}
            headerLeft={<BackButton />}
            headerRight={
                existing ? (
                    <IconButton
                        icon="Trash"
                        variant="outline"
                        accessibilityLabel="Remove block"
                        onPress={() => setPopup({ kind: 'delete' })}
                    />
                ) : undefined
            }>
            <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
                <SectionHeader title="What" />
                <TextInput
                    value={title}
                    onChangeText={text => setTitle(text.slice(0, MAX_TITLE))}
                    placeholder="e.g. Lunch, Deep work, Gym"
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
                <View style={styles.chips}>
                    {SUGGESTIONS.map(s => (
                        <Chip
                            key={s.title}
                            icon={s.icon}
                            label={s.title}
                            selected={!habitId && trimmed === s.title}
                            onPress={() => pickSuggestion(s)}
                        />
                    ))}
                </View>

                <SectionHeader title="When" />
                <Card>
                    <View style={styles.times}>
                        <TimeInput
                            label="Start"
                            hourValue={startH}
                            minutesValue={startM}
                            setHour={setStartH}
                            setMinutes={setStartM}
                        />
                        <View style={styles.timeGap}>
                            <Icon name="ArrowRight" size={18} tint={theme.colors.muted} />
                        </View>
                        <TimeInput
                            label="End"
                            hourValue={endH}
                            minutesValue={endM}
                            setHour={setEndH}
                            setMinutes={setEndM}
                        />
                    </View>
                    <ThemedText size="small" color="muted" align="center" tabular style={styles.length}>
                        {start !== null && end !== null && end > start
                            ? `${blockTimes({ start, end })} · ${formatDuration(end - start)}`
                            : ' '}
                    </ThemedText>
                </Card>
                <View style={styles.chips}>
                    {LENGTHS.map(length => (
                        <Chip
                            key={length}
                            label={formatDuration(length)}
                            selected={start !== null && end !== null && end - start === length}
                            onPress={() => setLength(length)}
                        />
                    ))}
                </View>
                {clashes.length > 0 && (
                    <ThemedText size="small" color="warning" style={styles.note}>
                        Overlaps {clashes.map(b => `${b.title} (${blockTimes(b)})`).join(', ')}.
                    </ThemedText>
                )}

                {dueHabits.length > 0 && (
                    <>
                        <SectionHeader title="Linked habit" />
                        <View style={styles.chips}>
                            <Chip label="None" selected={!habitId} onPress={() => pickHabit(null)} />
                            {dueHabits.map(habit => (
                                <Chip
                                    key={habit.id}
                                    icon={habit.icon}
                                    label={habit.title}
                                    selected={habitId === habit.id}
                                    onPress={() => pickHabit(habit)}
                                />
                            ))}
                        </View>
                        <ThemedText size="small" color="muted" style={styles.note}>
                            {linked
                                ? `Checking this block off also checks off “${linked.title}”, and the block only appears on the days the habit is due.`
                                : 'Link a habit to check both off at once.'}
                        </ThemedText>
                    </>
                )}

                <SectionHeader title="Icon" />
                <Card style={styles.iconGrid}>
                    {PLAN_ICONS.map(name => {
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

                <SectionHeader title="Following days" />
                <ListGroup>
                    <ListRow
                        icon="Restart"
                        title="Keep in the next day's plan"
                        description={
                            repeat
                                ? 'Copied into each new day, like the rest of your routine'
                                : 'Only on this day, e.g. an appointment'
                        }>
                        <Toggle value={repeat} onValueChange={setRepeat} />
                    </ListRow>
                </ListGroup>

                {problem && trimmed.length > 0 && (
                    <ThemedText size="small" color="primaryRed" style={styles.problem}>
                        {problem}
                    </ThemedText>
                )}
                <Button
                    label={existing ? 'Save changes' : 'Add to plan'}
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
                title={`Remove “${existing?.title ?? ''}”?`}
                message={
                    existing?.habitId
                        ? 'It leaves this day’s plan and the days copied from it. The habit itself stays.'
                        : 'It leaves this day’s plan and the days copied from it.'
                }
                actions={confirmActions(() => setPopup(null), 'Remove', confirmDelete, true)}
            />
            <ErrorPopup {...ERRORS.saveFailed} visible={popup?.kind === 'error'} onClose={() => setPopup(null)} />
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
    times: {
        flexDirection: 'row',
        alignItems: 'flex-end',
    },
    timeGap: {
        height: 52,
        justifyContent: 'center',
        marginHorizontal: spacing.sm,
    },
    length: {
        marginTop: spacing.sm,
    },
    note: {
        marginHorizontal: gutter + 2,
        marginTop: spacing.xs,
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
    problem: {
        marginTop: spacing.lg,
        marginHorizontal: gutter + 2,
    },
    save: {
        marginHorizontal: gutter,
        marginTop: spacing.lg,
    },
});

export default PlanBlockEditorScreen;
