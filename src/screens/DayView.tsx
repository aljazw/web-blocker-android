import { APP_NAME } from '../constants/brand';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Habit, RootStackNavigation } from '../types/types';
import Button from '../components/Button';
import Dialog from '../components/Dialog';
import Icon from '../components/Icon';
import EmptyState from '../components/EmptyState';
import ErrorPopup from '../components/ErrorPopup';
import PlanNowCard from '../components/PlanNowCard';
import PlanTimeline from '../components/PlanTimeline';
import { ThemedText } from '../components/ThemedText';
import { FadeIn, animateLayout } from '../components/Motion';
import { useDayPlan } from '../hooks/useDayPlan';
import { useTheme } from '../context/ThemeContext';
import { gutter, spacing } from '../theme';
import {
    DaySchedule,
    PlanTask,
    Slot,
    formatDuration,
    formatMinutes,
    paceOf,
    plannedMinutes,
    scheduleDay,
    starterRoutine,
} from '../utils/dayPlan';
import { currentStreak, fromDateKey, milestoneFor, newHabitId } from '../utils/habits';
import { milestoneMessage } from '../utils/habitText';
import { completeTask, moveLater, setOrder, setSkipped, undoTask } from '../utils/planService';
import { getHabits, saveHabits } from '../storage';
import { haptics } from '../utils/haptics';
import { ERRORS } from '../constants/strings';

type Popup =
    | { kind: 'task'; slot: Slot }
    | { kind: 'milestone'; habit: Habit; days: number }
    | { kind: 'dayComplete' }
    | { kind: 'error' };

interface DayViewProps {
    dateKey: string;
    /** Minutes after midnight when the day is today; null for tomorrow. */
    now: number | null;
}

/** One day of the plan: the task on now, how the day is going, and every task until bedtime. */
const DayView: React.FC<DayViewProps> = ({ dateKey, now }) => {
    const navigation = useNavigation<RootStackNavigation>();
    const { tasks, habits, anchors, loaded } = useDayPlan(dateKey);
    const [popup, setPopup] = useState<Popup | null>(null);
    const [dragging, setDragging] = useState(false);
    const schedule = scheduleDay(tasks, anchors, now);
    const isToday = now !== null;
    const close = () => setPopup(null);

    /** Runs a change to the day; reports failure. */
    const run = async (change: Promise<boolean>) => {
        animateLayout();
        if (!(await change)) {
            setPopup({ kind: 'error' });
            return false;
        }
        return true;
    };

    const done = async (task: PlanTask) => {
        close();
        if (!(await run(completeTask(dateKey, task, now ?? 0)))) {
            return;
        }
        haptics.success();
        const habit = task.habit && (await getHabits()).find(h => h.id === task.habit!.id);
        const milestone = habit ? milestoneFor(currentStreak(habit, fromDateKey(dateKey))) : null;
        if (habit && milestone) {
            setPopup({ kind: 'milestone', habit, days: milestone });
        } else if (!tasks.some(t => t.id !== task.id && t.status === 'open')) {
            setPopup({ kind: 'dayComplete' });
        }
    };

    const undo = async (task: PlanTask) => {
        close();
        if (await run(undoTask(dateKey, task))) {
            haptics.tap();
        }
    };

    const skip = async (task: PlanTask, skipped: boolean) => {
        close();
        if (await run(setSkipped(dateKey, task.id, skipped))) {
            haptics.tap();
        }
    };

    const later = async (task: PlanTask) => {
        if (await run(moveLater(dateKey, tasks, task.id))) {
            haptics.tap();
        }
    };

    const edit = (task: PlanTask) => {
        close();
        navigation.navigate('TaskEditor', task.habit ? { habitId: task.habit.id } : { date: dateKey, taskId: task.id });
    };

    const add = () => navigation.navigate('TaskEditor', { date: dateKey });

    /** A task dragged to a new place. No layout animation: the rows are already where they belong. */
    const reorder = async (ids: string[]) => {
        const ok = await setOrder(dateKey, ids);
        if (!ok) {
            setPopup({ kind: 'error' });
        }
        return ok;
    };

    const startRoutine = async () => {
        if (await run(saveHabits(starterRoutine(new Date(), newHabitId)))) {
            haptics.success();
        }
    };

    if (loaded && tasks.length === 0) {
        return habits.length === 0 ? (
            <EmptyState
                icon="Plan"
                title="Build your routine"
                text={`Add what you do in a day and how long each thing takes. ${APP_NAME} lines it all up between waking up and bedtime, and moves the rest along when something runs long.`}>
                <Button label="Start from a typical day" icon="Sparkles" iconLeading onPress={startRoutine} />
                <Button
                    label="Add a task"
                    variant="secondary"
                    icon="Plus"
                    iconLeading
                    onPress={add}
                    style={styles.gap}
                />
            </EmptyState>
        ) : (
            <EmptyState icon="Plan" title="Nothing planned" text="None of your routine falls on this day.">
                <Button label="Add a task" icon="Plus" iconLeading onPress={add} />
            </EmptyState>
        );
    }

    const task = popup?.kind === 'task' ? popup.slot.task : null;

    return (
        <>
            <ScrollView contentContainerStyle={styles.scroll} scrollEnabled={!dragging}>
                {isToday && (
                    <FadeIn>
                        <PlanNowCard
                            schedule={schedule}
                            now={now}
                            onDone={done}
                            onLater={later}
                            onSkip={t => skip(t, true)}
                        />
                    </FadeIn>
                )}
                <DaySummary schedule={schedule} tasks={tasks} />
                <PlanTimeline
                    schedule={schedule}
                    onOpen={slot => setPopup({ kind: 'task', slot })}
                    onToggle={
                        isToday ? slot => (slot.task.status === 'done' ? undo(slot.task) : done(slot.task)) : undefined
                    }
                    onAnchor={() => navigation.navigate('DayHours')}
                    onReorder={reorder}
                    onDragChange={setDragging}
                />
                <Button
                    label="Add a task"
                    icon="Plus"
                    iconLeading
                    variant="ghost"
                    compact
                    onPress={add}
                    style={styles.add}
                />
            </ScrollView>

            <Dialog
                visible={!!task}
                onClose={close}
                icon={task?.icon}
                title={task?.title ?? ''}
                message={task ? taskDescription(task) : undefined}
                actions={
                    !task
                        ? []
                        : task.status === 'done'
                        ? [
                              { label: 'Edit', onPress: () => edit(task), variant: 'secondary' },
                              { label: 'Not done', onPress: () => undo(task) },
                          ]
                        : task.status === 'skipped'
                        ? [
                              { label: 'Edit', onPress: () => edit(task), variant: 'secondary' },
                              { label: 'Bring back', onPress: () => skip(task, false) },
                          ]
                        : [
                              { label: 'Edit', onPress: () => edit(task), variant: 'secondary' },
                              { label: 'Skip', onPress: () => skip(task, true), variant: 'secondary' },
                              ...(isToday ? [{ label: 'Done', onPress: () => done(task) }] : []),
                          ]
                }
            />
            <Dialog
                visible={popup?.kind === 'milestone'}
                onClose={close}
                icon="Award"
                tone="success"
                title={popup?.kind === 'milestone' ? `${popup.days}-day streak` : ''}
                message={popup?.kind === 'milestone' ? `${popup.habit.title}. ${milestoneMessage(popup.days)}` : ''}
                actions={[{ label: 'Continue', onPress: close }]}
            />
            <Dialog
                visible={popup?.kind === 'dayComplete'}
                onClose={close}
                icon="Award"
                tone="success"
                title="Day complete"
                message="You did what you said you would. That's how discipline is built."
                actions={[{ label: 'Close', onPress: close }]}
            />
            <ErrorPopup {...ERRORS.saveFailed} visible={popup?.kind === 'error'} onClose={close} />
        </>
    );
};

/** "45 min · Every day · 5-day streak", or what skipping means. */
const taskDescription = (task: PlanTask): string => {
    const parts = [formatDuration(task.duration)];
    if (task.habit) {
        const streak = currentStreak(task.habit);
        if (streak > 0) {
            parts.push(`${streak}-day streak`);
        }
    } else {
        parts.push('Only this day');
    }
    const line = parts.join(' · ');
    return task.status === 'open' && task.habit ? `${line}\nSkipping it ends its streak.` : line;
};

/** How the day is going: total time of the tasks, pace, when it ends, and what won't fit before bed. */
const DaySummary: React.FC<{ schedule: DaySchedule; tasks: PlanTask[] }> = ({ schedule, tasks }) => {
    const { colors } = useTheme().theme;
    const pace = paceOf(schedule.behind);
    const { overflow, anchors } = schedule;
    const total = plannedMinutes(tasks);
    const left = plannedMinutes(tasks.filter(t => t.status === 'open'));
    const status = !pace
        ? null
        : pace.kind === 'onTime'
        ? 'On time'
        : pace.kind === 'behind'
        ? `${formatDuration(pace.minutes)} behind`
        : `${formatDuration(pace.minutes)} ahead`;
    const ends = schedule.slots.some(s => s.task.status === 'open')
        ? `done around ${formatMinutes(schedule.end)}`
        : null;
    // "Left" only once some of the day is done, otherwise it just repeats the total.
    const remaining = left > 0 && left < total ? ` · ${formatDuration(left)} left` : '';

    return (
        <>
            <View style={styles.totalRow}>
                <Icon name="Hourglass" size={14} tint={colors.muted} />
                <ThemedText size="small" weight="medium" tabular color="muted" style={styles.totalText}>
                    {`${formatDuration(total)} in total${remaining}`}
                </ThemedText>
                {tasks.filter(t => t.status !== 'done').length > 1 && (
                    <ThemedText size="tiny" color="muted">
                        Hold a task to move it
                    </ThemedText>
                )}
            </View>
            {(status || ends) && (
                <ThemedText
                    size="small"
                    weight="medium"
                    tabular
                    color={
                        pace?.kind === 'behind'
                            ? 'warning'
                            : pace?.kind === 'onTime' || pace?.kind === 'ahead'
                            ? 'primaryGreen'
                            : 'muted'
                    }
                    style={styles.summary}>
                    {[status, ends].filter(Boolean).join(' · ')}
                </ThemedText>
            )}
            {overflow.length > 0 && (
                <ThemedText size="small" color="warning" style={styles.summary}>
                    {`${listTitles(overflow)} won’t fit before bed at ${formatMinutes(
                        anchors.bed,
                    )}. Skip something or make it shorter.`}
                </ThemedText>
            )}
        </>
    );
};

/** "Read", "Read and Walk", "Read, Walk and 2 more". */
const listTitles = (tasks: PlanTask[]): string => {
    const names = tasks.map(t => t.title);
    if (names.length <= 2) {
        return names.join(' and ');
    }
    return `${names[0]}, ${names[1]} and ${names.length - 2} more`;
};

const styles = StyleSheet.create({
    scroll: {
        paddingBottom: spacing.xl,
    },
    gap: {
        marginTop: spacing.sm,
    },
    summary: {
        marginHorizontal: gutter + 2,
        marginTop: spacing.xs,
    },
    totalRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginHorizontal: gutter + 2,
        marginTop: spacing.sm,
    },
    totalText: {
        flex: 1,
        marginLeft: spacing.xs + 2,
    },
    add: {
        alignSelf: 'flex-start',
        marginHorizontal: gutter - spacing.sm,
        marginTop: spacing.xs,
    },
});

export default DayView;
