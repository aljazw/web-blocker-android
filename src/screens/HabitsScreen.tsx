import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Habit, RootStackNavigation } from '../types/types';
import BaseScreen from '../components/BaseScreen';
import Button from '../components/Button';
import Celebration from '../components/Celebration';
import ErrorPopup from '../components/ErrorPopup';
import HabitCard from '../components/HabitCard';
import Icon from '../components/Icon';
import SectionHeader from '../components/SectionHeader';
import StatTile from '../components/StatTile';
import { ThemedText } from '../components/ThemedText';
import { ThemedView } from '../components/ThemedView';
import { AnimatedBar, FadeIn, animateLayout, stagger } from '../components/Motion';
import { useTheme } from '../context/ThemeContext';
import { useHabits } from '../hooks/useHabits';
import { shapes, spacing } from '../theme';
import { completionRate, currentStreak, isDoneOn, isScheduled, milestoneFor, quoteOfTheDay } from '../utils/habits';
import { milestoneMessage } from '../utils/habitText';
import { haptics } from '../utils/haptics';
import { ERRORS } from '../constants/strings';

type Moment =
    | { kind: 'milestone'; habit: Habit; days: number }
    | { kind: 'perfectDay' }
    | { kind: 'error'; title: string; text: string };

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
            setMoment({ kind: 'error', ...ERRORS.saveFailed });
            return;
        }
        const updated = result.habit;
        if (wasDone) {
            haptics.tap();
            return;
        }
        haptics.success();

        const milestone = milestoneFor(currentStreak(updated, today));
        const nowAllDone = due.every(h => (h.id === habit.id ? true : isDoneOn(h, today)));
        if (milestone) {
            setMoment({ kind: 'milestone', habit: updated, days: milestone });
        } else if (nowAllDone && due.length > 1) {
            setMoment({ kind: 'perfectDay' });
        }
    };

    const addButton = (
        <Pressable
            onPress={() => openEditor()}
            accessibilityRole="button"
            accessibilityLabel="New habit"
            hitSlop={8}
            style={[styles.addButton, { backgroundColor: theme.colors.accent }]}>
            <Icon name="Plus" size={22} tint={theme.colors.onAccent} />
        </Pressable>
    );

    return (
        <BaseScreen title="Today" subtitle={todayLabel(today)} headerRight={addButton}>
            <ScrollView contentContainerStyle={styles.scroll}>
                {/* ---- Progress hero ---- */}
                <FadeIn>
                    <View
                        style={[
                            styles.hero,
                            { backgroundColor: allDone ? theme.colors.primaryGreen : theme.colors.accent },
                        ]}>
                        <ThemedText size="tiny" weight="strong" style={styles.heroEyebrow}>
                            {allDone ? 'PERFECT DAY' : 'TODAY’S PROGRESS'}
                        </ThemedText>
                        <ThemedText size="display" weight="strong" style={styles.onHero}>
                            {habits.length === 0 ? 'Day one' : due.length === 0 ? 'Rest day' : `${doneCount} / ${due.length}`}
                        </ThemedText>
                        <ThemedText weight="medium" style={styles.onHeroMuted}>
                            {due.length === 0
                                ? habits.length === 0
                                    ? 'Create a habit to start your first streak.'
                                    : 'Nothing due today — enjoy it.'
                                : allDone
                                ? 'Every habit done. You showed up today 🎉'
                                : `${due.length - doneCount} to go — you’ve got this.`}
                        </ThemedText>
                        {due.length > 0 && (
                            <View style={styles.heroTrack}>
                                <AnimatedBar
                                    fraction={doneCount / due.length}
                                    color="#FFFFFF"
                                    style={styles.heroFill}
                                />
                            </View>
                        )}
                        <ThemedText size="small" style={styles.quote}>
                            “{quoteOfTheDay(today)}”
                        </ThemedText>
                    </View>
                </FadeIn>

                {habits.length > 0 && (
                    <FadeIn delay={80} style={styles.statsRow}>
                        <StatTile label="Top streak" value={topStreak} suffix="🔥" />
                        <StatTile label="This week" value={Math.round((weekRate ?? 0) * 100)} suffix="%" />
                        <StatTile label="Check-ins" value={totalCheckIns} />
                    </FadeIn>
                )}

                {/* ---- Lists ---- */}
                {loaded && habits.length === 0 ? (
                    <FadeIn delay={140}>
                        <ThemedView withBorder style={styles.empty}>
                            <ThemedText style={styles.emptyEmoji}>🌱</ThemedText>
                            <ThemedText size="large" weight="strong" align="center">
                                Build your first habit
                            </ThemedText>
                            <ThemedText size="small" color="muted" align="center" style={styles.emptyText}>
                                Small daily wins add up. Pick something tiny — like a 10-minute workout — and check it
                                off each day to grow your streak.
                            </ThemedText>
                            <Button label="Create a habit" icon="ArrowRight" onPress={() => openEditor()} />
                        </ThemedView>
                    </FadeIn>
                ) : (
                    <>
                        {due.length > 0 && <SectionHeader title={`Due today · ${doneCount}/${due.length}`} />}
                        {due.map((habit, i) => (
                            <FadeIn key={habit.id} delay={120 + stagger(i)}>
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
                            <FadeIn key={habit.id} delay={160 + stagger(due.length + i)}>
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

            <Celebration
                visible={moment?.kind === 'milestone'}
                emoji="🔥"
                title={moment?.kind === 'milestone' ? `${moment.days}-day streak!` : ''}
                message={
                    moment?.kind === 'milestone'
                        ? `${moment.habit.emoji} ${moment.habit.title}. ${milestoneMessage(moment.days)}`
                        : ''
                }
                onClose={() => setMoment(null)}
            />
            <Celebration
                visible={moment?.kind === 'perfectDay'}
                emoji="🏆"
                title="Perfect day!"
                message="Every habit for today is done. That’s how progress is made."
                onClose={() => setMoment(null)}
            />
            <ErrorPopup
                title={moment?.kind === 'error' ? moment.title : ERRORS.saveFailed.title}
                text={moment?.kind === 'error' ? moment.text : ''}
                visible={moment?.kind === 'error'}
                onClose={() => setMoment(null)}
            />
        </BaseScreen>
    );
};

const styles = StyleSheet.create({
    scroll: {
        paddingBottom: spacing.xl,
    },
    addButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
    },
    hero: {
        marginHorizontal: spacing.md,
        marginTop: spacing.sm,
        padding: spacing.lg,
        borderRadius: shapes.borderRadius.large,
    },
    heroEyebrow: {
        color: 'rgba(255,255,255,0.85)',
        letterSpacing: 1.2,
        marginBottom: spacing.xs,
    },
    onHero: {
        color: '#FFFFFF',
    },
    onHeroMuted: {
        color: 'rgba(255,255,255,0.9)',
    },
    heroTrack: {
        height: 8,
        borderRadius: 4,
        backgroundColor: 'rgba(255,255,255,0.25)',
        overflow: 'hidden',
        marginTop: spacing.md,
    },
    heroFill: {
        height: '100%',
        borderRadius: 4,
    },
    quote: {
        color: 'rgba(255,255,255,0.8)',
        fontStyle: 'italic',
        marginTop: spacing.md,
    },
    statsRow: {
        flexDirection: 'row',
        marginHorizontal: spacing.md - 4,
        marginTop: spacing.sm,
    },
    empty: {
        marginHorizontal: spacing.md,
        marginTop: spacing.lg,
        padding: spacing.lg,
        borderRadius: shapes.borderRadius.large,
        alignItems: 'center',
    },
    emptyEmoji: {
        fontSize: 48,
        lineHeight: 60,
        marginBottom: spacing.sm,
    },
    emptyText: {
        marginTop: spacing.xs,
        marginBottom: spacing.lg,
    },
});

export default HabitsScreen;
