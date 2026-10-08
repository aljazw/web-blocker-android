import React, { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Habit, RootStackNavigation } from '../types/types';
import BaseScreen from '../components/BaseScreen';
import Button from '../components/Button';
import Card from '../components/Card';
import Dialog from '../components/Dialog';
import ErrorPopup from '../components/ErrorPopup';
import HabitCard from '../components/HabitCard';
import IconButton from '../components/IconButton';
import IconTile from '../components/IconTile';
import ProgressBar from '../components/ProgressBar';
import SectionHeader from '../components/SectionHeader';
import StatRow from '../components/StatRow';
import StatTile from '../components/StatTile';
import { ThemedText } from '../components/ThemedText';
import { FadeIn, animateLayout, stagger } from '../components/Motion';
import { useTheme } from '../context/ThemeContext';
import { useHabits } from '../hooks/useHabits';
import { spacing } from '../theme';
import { completionRate, currentStreak, isDoneOn, isScheduled, milestoneFor } from '../utils/habits';
import { milestoneMessage } from '../utils/habitText';
import { haptics } from '../utils/haptics';
import { ERRORS } from '../constants/strings';

type Moment = { kind: 'milestone'; habit: Habit; days: number } | { kind: 'error' };

const todayLabel = (date: Date) =>
    date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

const HabitsScreen: React.FC = () => {
    const { theme } = useTheme();
    const navigation = useNavigation<RootStackNavigation>();
    const { habits, loaded, toggleToday } = useHabits();
    const [moment, setMoment] = useState<Moment | null>(null);

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
            title="Habits"
            subtitle={todayLabel(today)}
            headerRight={
                <IconButton icon="Plus" variant="filled" accessibilityLabel="New habit" onPress={() => openEditor()} />
            }>
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
                    <FadeIn delay={60}>
                        <Card style={styles.empty}>
                            <IconTile icon="Habits" tone="accent" size={44} />
                            <ThemedText size="large" weight="bold" style={styles.emptyTitle}>
                                Build a daily routine
                            </ThemedText>
                            <ThemedText color="muted" style={styles.emptyText}>
                                Track small, repeatable actions such as a 10-minute workout or reading. Choose the days
                                each habit is due and check it off to build a streak.
                            </ThemedText>
                            <Button label="Create a habit" icon="Plus" iconLeading onPress={() => openEditor()} />
                        </Card>
                    </FadeIn>
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
    empty: {
        marginTop: spacing.md,
        padding: spacing.lg,
    },
    emptyTitle: {
        marginTop: spacing.md,
    },
    emptyText: {
        marginTop: spacing.xs,
        marginBottom: spacing.lg,
    },
});

export default HabitsScreen;
