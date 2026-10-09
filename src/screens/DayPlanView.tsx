import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Habit, PlanBlock, PlanPrefs, RootStackNavigation } from '../types/types';
import Button from '../components/Button';
import Card from '../components/Card';
import Chip from '../components/Chip';
import Dialog, { confirmActions } from '../components/Dialog';
import ErrorPopup from '../components/ErrorPopup';
import IconTile from '../components/IconTile';
import { ListGroup, ListRow, Toggle } from '../components/ListGroup';
import PlanNowCard from '../components/PlanNowCard';
import PlanTimeline from '../components/PlanTimeline';
import SectionHeader from '../components/SectionHeader';
import { ThemedText } from '../components/ThemedText';
import { FadeIn, animateLayout } from '../components/Motion';
import { useDayPlan } from '../hooks/useDayPlan';
import { gutter, spacing } from '../theme';
import { addDays, toDateKey } from '../utils/dates';
import {
    DEFAULT_BLOCK_LENGTH,
    DAY_MINUTES,
    Gap,
    blockForHabit,
    findFreeSlot,
    formatDuration,
    isBlockDone,
    minutesNow,
    starterPlan,
    unplannedHabits,
    visibleBlocks,
} from '../utils/dayPlan';
import { ensureReminderPermission } from '../utils/habitReminders';
import { syncPlanReminders } from '../utils/planService';
import { DEFAULT_PLAN_PREFS, getPlanPrefs, getSleepSchedule, setPlanPrefs } from '../utils/storage';
import { haptics } from '../utils/haptics';
import { ERRORS } from '../constants/strings';

type Day = 'today' | 'tomorrow';
type Popup = { kind: 'dayComplete'; count: number } | { kind: 'clear' } | { kind: 'error' };

interface DayPlanViewProps {
    habits: Habit[];
    /** Checks a habit off for today (or undoes it), as on the habit list. */
    onToggleHabit: (habit: Habit) => Promise<boolean>;
}

/** The day plan: what's on now, the day's timeline, and quick ways to fill it from habits. */
const DayPlanView: React.FC<DayPlanViewProps> = ({ habits, onToggleHabit }) => {
    const navigation = useNavigation<RootStackNavigation>();
    const [day, setDay] = useState<Day>('today');
    const [now, setNow] = useState(new Date());
    const [prefs, setPrefs] = useState<PlanPrefs>(DEFAULT_PLAN_PREFS);
    const [popup, setPopup] = useState<Popup | null>(null);

    const todayKey = toDateKey(now);
    const dateKey = day === 'today' ? todayKey : toDateKey(addDays(now, 1));
    const { plan, loaded, commit, setBlockDone, addBlocks } = useDayPlan(dateKey);

    // Keep "now" fresh: the current block, its progress and the day rolling over.
    useEffect(() => {
        const id = setInterval(() => setNow(new Date()), 30_000);
        return () => clearInterval(id);
    }, []);
    useFocusEffect(
        useCallback(() => {
            setNow(new Date());
            getPlanPrefs().then(setPrefs);
        }, []),
    );

    const isToday = day === 'today';
    const nowMin = minutesNow(now);
    const blocks = visibleBlocks(plan, habits);
    const suggestions = unplannedHabits(plan, habits);
    const totalMinutes = blocks.reduce((sum, b) => sum + (b.end - b.start), 0);

    const fail = () => setPopup({ kind: 'error' });

    const openEditor = (params: { blockId?: string; start?: number; end?: number; habitId?: string } = {}) =>
        navigation.navigate('PlanBlockEditor', { date: dateKey, ...params });

    const addBlock = () => {
        const from = isToday ? nowMin : blocks.length ? blocks[blocks.length - 1].end : 8 * 60;
        const start = findFreeSlot(blocks, DEFAULT_BLOCK_LENGTH, Math.min(from, DAY_MINUTES - DEFAULT_BLOCK_LENGTH));
        openEditor({ start, end: start + DEFAULT_BLOCK_LENGTH });
    };

    const addInGap = (gap: Gap) => openEditor({ start: gap.start, end: Math.min(gap.end, gap.start + 60) });

    const addHabit = async (habit: Habit) => {
        animateLayout();
        const block = blockForHabit(habit, plan.blocks, isToday ? nowMin : 8 * 60);
        if (await addBlocks([block])) {
            haptics.tap();
        } else {
            fail();
        }
    };

    const applyStarter = async () => {
        await ensureReminderPermission();
        const starter = starterPlan(dateKey, habits, await getSleepSchedule());
        animateLayout();
        if (await commit(starter)) {
            haptics.success();
        } else {
            fail();
        }
    };

    const toggle = async (block: PlanBlock) => {
        const wasDone = isBlockDone(block, habits, dateKey);
        animateLayout();
        let ok: boolean;
        if (block.habitId) {
            const habit = habits.find(h => h.id === block.habitId);
            ok = !!habit && (await onToggleHabit(habit));
        } else {
            ok = await setBlockDone(block, !wasDone);
        }
        if (!ok) {
            fail();
            return;
        }
        if (wasDone) {
            haptics.tap();
            return;
        }
        haptics.success();
        // Linked habits update through props, so count this block as done explicitly.
        const remaining = blocks.filter(b => b.id !== block.id && !isBlockDone(b, habits, dateKey));
        if (remaining.length === 0) {
            setPopup({ kind: 'dayComplete', count: blocks.length });
        }
    };

    const changePrefs = async (change: Partial<PlanPrefs>) => {
        if (change.reminders) {
            await ensureReminderPermission();
        }
        const next = { ...prefs, ...change };
        setPrefs(next);
        if (await setPlanPrefs(next)) {
            syncPlanReminders();
        } else {
            setPrefs(prefs);
            fail();
        }
    };

    const clearDay = async () => {
        setPopup(null);
        animateLayout();
        if (!(await commit({ ...plan, blocks: [] }))) {
            fail();
        }
    };

    const dateLabel = (offset: number) =>
        addDays(now, offset).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });

    return (
        <>
            <ScrollView contentContainerStyle={styles.scroll}>
                <View style={styles.days}>
                    <Chip label={`Today · ${dateLabel(0)}`} selected={isToday} onPress={() => setDay('today')} />
                    <Chip label={`Tomorrow · ${dateLabel(1)}`} selected={!isToday} onPress={() => setDay('tomorrow')} />
                </View>

                {isToday && blocks.length > 0 && (
                    <FadeIn>
                        <PlanNowCard blocks={blocks} habits={habits} dateKey={dateKey} now={nowMin} onToggle={toggle} />
                    </FadeIn>
                )}
                {!isToday && blocks.length > 0 && (
                    <ThemedText size="small" color="muted" style={styles.hint}>
                        Tomorrow starts as a copy of today. Change only what's different, and it's ready.
                    </ThemedText>
                )}

                {loaded && blocks.length === 0 ? (
                    <FadeIn delay={40}>
                        <Card style={styles.empty}>
                            <IconTile icon="Plan" tone="accent" size={44} />
                            <ThemedText size="large" weight="bold" style={styles.emptyTitle}>
                                Plan {isToday ? 'your day' : 'tomorrow'}
                            </ThemedText>
                            <ThemedText color="muted" style={styles.emptyText}>
                                Give every part of the day a time window: meals, workouts, work and your habits. You
                                build it once. After that, each new day starts as a copy and you only adjust what
                                changes.
                            </ThemedText>
                            <Button
                                label="Start from a typical day"
                                icon="Sparkles"
                                iconLeading
                                onPress={applyStarter}
                            />
                            <Button
                                label="Add blocks myself"
                                variant="secondary"
                                icon="Plus"
                                iconLeading
                                onPress={addBlock}
                                style={styles.emptySecond}
                            />
                        </Card>
                    </FadeIn>
                ) : blocks.length > 0 ? (
                    <>
                        <SectionHeader
                            title={`Schedule · ${blocks.length} blocks · ${formatDuration(totalMinutes)}`}
                            right={
                                <Button
                                    label="Add"
                                    icon="Plus"
                                    iconLeading
                                    variant="ghost"
                                    compact
                                    onPress={addBlock}
                                    style={styles.headerButton}
                                />
                            }
                        />
                        <PlanTimeline
                            blocks={blocks}
                            habits={habits}
                            dateKey={dateKey}
                            now={isToday ? nowMin : null}
                            onOpen={block => openEditor({ blockId: block.id })}
                            onToggle={isToday ? toggle : undefined}
                            onAddInGap={addInGap}
                        />
                    </>
                ) : null}

                {loaded && suggestions.length > 0 && (
                    <>
                        <SectionHeader title="Habits not in the plan" />
                        <View style={styles.chips}>
                            {suggestions.map(habit => (
                                <Chip
                                    key={habit.id}
                                    icon={habit.icon}
                                    label={`${habit.title}${habit.reminder ? ` · ${habit.reminder}` : ''}`}
                                    onPress={() => addHabit(habit)}
                                />
                            ))}
                        </View>
                        <ThemedText size="tiny" color="muted" style={styles.chipsHint}>
                            Tap to add it to the plan. Checking the block off also checks off the habit.
                        </ThemedText>
                    </>
                )}

                {blocks.length > 0 && (
                    <>
                        <SectionHeader title="Staying on track" />
                        <ListGroup>
                            <ListRow
                                icon="Bell"
                                title="Block reminders"
                                description="A notification as each block starts, and one in the evening to plan tomorrow">
                                <Toggle value={prefs.reminders} onValueChange={v => changePrefs({ reminders: v })} />
                            </ListRow>
                            <ListRow
                                icon="Target"
                                title="Check-in pop-ups"
                                description="When you open Gaman: what's on now, and whether you finished the last block">
                                <Toggle value={prefs.nudges} onValueChange={v => changePrefs({ nudges: v })} />
                            </ListRow>
                        </ListGroup>
                        <Button
                            label={isToday ? 'Clear today' : 'Clear tomorrow'}
                            variant="ghost"
                            compact
                            onPress={() => setPopup({ kind: 'clear' })}
                            style={styles.clear}
                        />
                    </>
                )}
            </ScrollView>

            <Dialog
                visible={popup?.kind === 'dayComplete'}
                onClose={() => setPopup(null)}
                icon="Award"
                tone="success"
                title="Plan complete"
                message={`All ${
                    popup?.kind === 'dayComplete' ? popup.count : ''
                } blocks done. You did what you said you would. That's how discipline is built.`}
                actions={[
                    { label: 'Close', onPress: () => setPopup(null), variant: 'secondary' },
                    {
                        label: 'Plan tomorrow',
                        onPress: () => {
                            setPopup(null);
                            setDay('tomorrow');
                        },
                    },
                ]}
            />
            <Dialog
                visible={popup?.kind === 'clear'}
                onClose={() => setPopup(null)}
                icon="Trash"
                tone="danger"
                title={`Clear ${isToday ? 'today' : 'tomorrow'}?`}
                message="Every block is removed from this day so you can start over. Your habits are not affected."
                actions={confirmActions(() => setPopup(null), 'Clear', clearDay, true)}
            />
            <ErrorPopup {...ERRORS.saveFailed} visible={popup?.kind === 'error'} onClose={() => setPopup(null)} />
        </>
    );
};

const styles = StyleSheet.create({
    scroll: {
        paddingBottom: spacing.xl,
    },
    days: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginHorizontal: gutter,
        marginTop: spacing.sm,
    },
    hint: {
        marginHorizontal: gutter + 2,
        marginTop: spacing.xs,
    },
    empty: {
        padding: spacing.lg,
    },
    emptyTitle: {
        marginTop: spacing.md,
    },
    emptyText: {
        marginTop: spacing.xs,
        marginBottom: spacing.lg,
    },
    emptySecond: {
        marginTop: spacing.sm,
    },
    headerButton: {
        marginVertical: -8,
        marginRight: -spacing.sm,
    },
    chips: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginHorizontal: gutter,
        marginTop: spacing.xs,
    },
    chipsHint: {
        marginHorizontal: gutter + 2,
        marginTop: spacing.xs,
    },
    clear: {
        alignSelf: 'center',
        marginTop: spacing.md,
    },
});

export default DayPlanView;
