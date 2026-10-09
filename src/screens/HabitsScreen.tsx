import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { Habit, RootStackNavigation, RoutineView, TabParamList } from '../types/types';
import BaseScreen from '../components/BaseScreen';
import Button from '../components/Button';
import Card from '../components/Card';
import Dialog from '../components/Dialog';
import EmptyState from '../components/EmptyState';
import ErrorPopup from '../components/ErrorPopup';
import HabitCard from '../components/HabitCard';
import IconButton from '../components/IconButton';
import ProgressBar from '../components/ProgressBar';
import Segmented from '../components/Segmented';
import SectionHeader from '../components/SectionHeader';
import StatRow from '../components/StatRow';
import StatTile from '../components/StatTile';
import { ThemedText } from '../components/ThemedText';
import { FadeIn, animateLayout, stagger } from '../components/Motion';
import { useTheme } from '../context/ThemeContext';
import { useHabits } from '../hooks/useHabits';
import { gutter, spacing } from '../theme';
import DayPlanView from './DayPlanView';
import { completionRate, currentStreak, isDoneOn, isScheduled, milestoneFor } from '../utils/habits';
import { milestoneMessage } from '../utils/habitText';
import { haptics } from '../utils/haptics';
import { ERRORS } from '../constants/strings';

type Moment = { kind: 'milestone'; habit: Habit; days: number } | { kind: 'error' };

const todayLabel = (date: Date) =>
    date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

const VIEWS: { value: RoutineView; label: string }[] = [
    { value: 'plan', label: 'Day plan' },
    { value: 'habits', label: 'Habits' },
];

/** The routine tab: the day plan, and the habits it's built from. */
const HabitsScreen: React.FC = () => {
    const { theme } = useTheme();
    const navigation = useNavigation<RootStackNavigation>();
    const route = useRoute<RouteProp<TabParamList, 'Habits'>>();
    const { habits, loaded, toggleToday } = useHabits();
    const [moment, setMoment] = useState<Moment | null>(null);
    const [view, setView] = useState<RoutineView>(route.params?.view ?? 'plan');

    // Opened from elsewhere (a pop-up, the overview) with a view in mind.
    useEffect(() => {
        if (route.params?.view) {
            setView(route.params.view);
        }
    }, [route.params]);

    const today = new Date();
    const due = habits.filter(h => isScheduled(h, today));
    const notDue = habits.filter(h => !isScheduled(h, today));
    const doneCount = due.filter(h => isDoneOn(h, today)).length;
    const allDone = due.length > 0 && doneCount === due.length;
    const topStreak = habits.reduce((max, h) => Math.max(max, currentStreak(h, today)), 0);
    const weekRate = completionRate(habits, 7, today);
    const totalCheckIns = habits.reduce((sum, h) => sum + h.completions.length, 0);

    const openEditor = (habitId?: string) => navigation.navigate('HabitEditor', habitId ? { habitId } : undefined);

    const onToggle = async (habit: Habit) => {
        const wasDone = isDoneOn(habit, today);
        animateLayout();
        const result = await toggleToday(habit);
        if (result.status === 'busy') {
            return;
        }
        if (result.status === 'failed') {
            setMoment({ kind: 'error' });
            return;
        }
        if (wasDone) {
            haptics.tap();
            return;
        }
        haptics.success();
        const milestone = milestoneFor(currentStreak(result.habit, today));
        if (milestone) {
            setMoment({ kind: 'milestone', habit: result.habit, days: milestone });
        }
    };

    /** For plan blocks linked to a habit; the plan does its own feedback. */
    const togglePlanHabit = async (habit: Habit) => {
        const result = await toggleToday(habit);
        if (result.status === 'saved' && result.habit.completions.length > habit.completions.length) {
            const milestone = milestoneFor(currentStreak(result.habit, today));
            if (milestone) {
                setMoment({ kind: 'milestone', habit: result.habit, days: milestone });
            }
        }
        return result.status !== 'failed';
    };

    const summary =
        habits.length === 0
            ? 'No habits yet'
            : due.length === 0
            ? 'Nothing scheduled today'
            : allDone
            ? 'All done for today'
            : `${due.length - doneCount} remaining`;

    return (
        <BaseScreen
            title={view === 'plan' ? 'Day plan' : 'Habits'}
            subtitle={todayLabel(today)}
            headerRight={
                view === 'habits' ? (
                    <IconButton
                        icon="Plus"
                        variant="filled"
                        accessibilityLabel="New habit"
                        onPress={() => openEditor()}
                    />
                ) : undefined
            }>
            <Segmented options={VIEWS} value={view} onChange={setView} style={styles.views} />
            {view === 'plan' ? (
                <DayPlanView habits={habits} onToggleHabit={togglePlanHabit} />
            ) : (
                <ScrollView contentContainerStyle={styles.scroll}>
                    {habits.length > 0 && (
                        <FadeIn>
                            <Card>
                                <ThemedText size="tiny" weight="strong" color="muted" caps>
                                    Today
                                </ThemedText>
                                <View style={styles.progressRow}>
                                    <ThemedText size="display" weight="bold" tabular>
                                        {doneCount}
                                        <ThemedText size="large" color="muted" weight="medium">
                                            {' '}
                                            / {due.length}
                                        </ThemedText>
                                    </ThemedText>
                                    <ThemedText
                                        size="small"
                                        weight="medium"
                                        color={allDone ? 'primaryGreen' : 'muted'}
                                        style={styles.summary}>
                                        {summary}
                                    </ThemedText>
                                </View>
                                {due.length > 0 && (
                                    <ProgressBar
                                        fraction={doneCount / due.length}
                                        color={allDone ? theme.colors.primaryGreen : theme.colors.accent}
                                        style={styles.progress}
                                    />
                                )}
                            </Card>
                            <StatRow>
                                <StatTile label="Best streak" value={topStreak} suffix=" d" />
                                <StatTile label="7-day rate" value={Math.round((weekRate ?? 0) * 100)} suffix="%" />
                                <StatTile label="Check-ins" value={totalCheckIns} />
                            </StatRow>
                        </FadeIn>
                    )}

                    {loaded && habits.length === 0 ? (
                        <EmptyState
                            icon="Habits"
                            title="Build a daily routine"
                            text="Track small, repeatable actions such as a 10-minute workout or reading. Choose the days each habit is due and check it off to build a streak.">
                            <Button label="Create a habit" icon="Plus" iconLeading onPress={() => openEditor()} />
                        </EmptyState>
                    ) : (
                        <>
                            {due.length > 0 && <SectionHeader title="Due today" />}
                            {due.map((habit, i) => (
                                <FadeIn key={habit.id} delay={60 + stagger(i)}>
                                    <HabitCard
                                        habit={habit}
                                        dueToday
                                        onToggle={() => onToggle(habit)}
                                        onOpen={() => openEditor(habit.id)}
                                    />
                                </FadeIn>
                            ))}
                            {notDue.length > 0 && <SectionHeader title="Other days" />}
                            {notDue.map((habit, i) => (
                                <FadeIn key={habit.id} delay={80 + stagger(due.length + i)}>
                                    <HabitCard
                                        habit={habit}
                                        dueToday={false}
                                        onToggle={() => undefined}
                                        onOpen={() => openEditor(habit.id)}
                                    />
                                </FadeIn>
                            ))}
                        </>
                    )}
                </ScrollView>
            )}

            <Dialog
                visible={moment?.kind === 'milestone'}
                onClose={() => setMoment(null)}
                icon="Award"
                tone="success"
                title={moment?.kind === 'milestone' ? `${moment.days}-day streak` : ''}
                message={moment?.kind === 'milestone' ? `${moment.habit.title}. ${milestoneMessage(moment.days)}` : ''}
                actions={[{ label: 'Continue', onPress: () => setMoment(null) }]}
            />
            <ErrorPopup {...ERRORS.saveFailed} visible={moment?.kind === 'error'} onClose={() => setMoment(null)} />
        </BaseScreen>
    );
};

const styles = StyleSheet.create({
    views: {
        marginHorizontal: gutter,
        marginBottom: spacing.xs,
    },
    scroll: {
        paddingBottom: spacing.xl,
    },
    progressRow: {
        flexDirection: 'row',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        marginTop: spacing.xs,
    },
    summary: {
        marginLeft: spacing.sm,
    },
    progress: {
        marginTop: spacing.md,
    },
});

export default HabitsScreen;
