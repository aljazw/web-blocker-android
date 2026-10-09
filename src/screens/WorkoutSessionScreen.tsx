import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { WorkoutCues, WorkoutSession } from '../types/types';
import BaseScreen from '../components/BaseScreen';
import Button from '../components/Button';
import Card from '../components/Card';
import Dialog, { confirmActions } from '../components/Dialog';
import IconButton from '../components/IconButton';
import IconTile from '../components/IconTile';
import ProgressBar from '../components/ProgressBar';
import ProgressRing from '../components/ProgressRing';
import { KeyValueRow } from '../components/ListGroup';
import { ThemedText } from '../components/ThemedText';
import { FadeIn } from '../components/Motion';
import { useTheme } from '../context/ThemeContext';
import { gutter, spacing } from '../theme';
import { formatClock, formatCountdown, formatSeconds } from '../utils/apnea';
import { apneaSession } from '../utils/apneaSession';
import {
    completeSet,
    countdown,
    currentExercise,
    describeTarget,
    endSession,
    extendRest,
    nextUp,
    skipRest,
    skipSet,
    startTimedSet,
    tick,
    totalSets,
} from '../utils/workout';
import { FinishedWorkout, saveFinishedWorkout } from '../utils/workoutSession';
import { getWorkoutCues, getWorkoutSession, setWorkoutSession } from '../storage';
import { haptics } from '../utils/haptics';
import { logger } from '../utils/logger';

const RING_SIZE = 248;
const TICK_MS = 200;
/** A longer gap between ticks means the app was in the background: catch up silently. */
const MAX_CUE_GAP_MS = 2000;

type CueName = 'HOLD' | 'BREATHE' | 'TICK';

const secondsLeft = (ms: number) => Math.ceil(ms / 1000);

const WorkoutSessionScreen: React.FC = () => {
    const navigation = useNavigation();
    const [session, setSession] = useState<WorkoutSession | null>(null);
    const [now, setNow] = useState(Date.now());
    const [summary, setSummary] = useState<FinishedWorkout | null>(null);
    const [confirmEnd, setConfirmEnd] = useState(false);
    const sessionRef = useRef<WorkoutSession | null>(null);
    const cuesRef = useRef<WorkoutCues>({ sound: true, vibration: true });
    const lastTick = useRef(Date.now());
    const saving = useRef(false);

    const cue = useCallback((name: CueName) => {
        const cues = cuesRef.current;
        if (cues.sound || cues.vibration) {
            apneaSession.previewCue(name, cues);
        }
    }, []);

    /** Shows and persists a new state, so closing the app never loses progress. */
    const apply = useCallback((next: WorkoutSession) => {
        sessionRef.current = next;
        setSession(next);
        setWorkoutSession(next).catch(error => logger.warn('Could not save workout progress', error));
    }, []);

    const act = (change: (s: WorkoutSession, now: number) => WorkoutSession) => {
        const current = sessionRef.current;
        if (!current) {
            return;
        }
        haptics.tap();
        const next = change(current, Date.now());
        if (next !== current) {
            apply(next);
        }
    };

    useEffect(() => {
        apneaSession.setKeepAwake(true);
        getWorkoutCues()
            .then(c => (cuesRef.current = c))
            .catch(() => undefined);
        getWorkoutSession()
            .then(s => {
                if (!s) {
                    navigation.goBack();
                    return;
                }
                lastTick.current = Date.now();
                apply(tick(s, Date.now()));
            })
            .catch(() => navigation.goBack());
        return () => apneaSession.setKeepAwake(false);
    }, [apply, navigation]);

    // The clock: resolves timed sets and rests, and plays cues for what just happened.
    useEffect(() => {
        const id = setInterval(() => {
            const t = Date.now();
            const quiet = t - lastTick.current > MAX_CUE_GAP_MS;
            const before = lastTick.current;
            lastTick.current = t;
            setNow(t);

            const prev = sessionRef.current;
            if (!prev || prev.phase === 'done') {
                return;
            }
            const next = tick(prev, t);
            if (next !== prev) {
                if (!quiet) {
                    cue(next.phase === 'rest' || next.phase === 'done' || prev.phase === 'work' ? 'BREATHE' : 'HOLD');
                }
                apply(next);
                return;
            }
            if (quiet) {
                return;
            }
            // Same phase: count down the last 3 seconds, and mark the end of the lead-in.
            const was = countdown(prev, before);
            const is = countdown(prev, t);
            if (!was || !is) {
                return;
            }
            if (was.kind === 'leadIn' && is.kind === 'work') {
                cue('HOLD');
            } else if (was.kind === is.kind) {
                const s = secondsLeft(is.remainingMs);
                if (s !== secondsLeft(was.remainingMs) && s >= 1 && s <= 3) {
                    cue('TICK');
                }
            }
        }, TICK_MS);
        return () => clearInterval(id);
    }, [apply, cue]);

    // Finished (or ended): save once, then show the summary.
    useEffect(() => {
        if (session?.phase !== 'done' || saving.current) {
            return;
        }
        saving.current = true;
        saveFinishedWorkout(session)
            .then(result => {
                if (!result) {
                    navigation.goBack();
                    return;
                }
                if (result.record.completed) {
                    haptics.success();
                }
                setSummary(result);
            })
            .catch(error => {
                logger.warn('Could not finish workout', error);
                navigation.goBack();
            });
    }, [session, navigation]);

    const live = session && session.phase !== 'done' ? session : null;

    return (
        <BaseScreen
            title={summary?.record.title ?? session?.title ?? ''}
            subtitle={summary ? 'Summary' : live ? `Exercise ${live.exercise + 1} of ${live.exercises.length}` : ''}
            headerRight={
                <IconButton
                    icon="Close"
                    variant="outline"
                    accessibilityLabel={live ? 'End workout' : 'Close'}
                    onPress={() => (live ? setConfirmEnd(true) : navigation.goBack())}
                />
            }
            isLoading={!session || (session.phase === 'done' && !summary)}>
            {summary ? (
                <SummaryView summary={summary} onDone={() => navigation.goBack()} />
            ) : live ? (
                <LiveView session={live} now={now} act={act} />
            ) : null}

            <Dialog
                visible={confirmEnd}
                onClose={() => setConfirmEnd(false)}
                icon="Stop"
                tone="danger"
                title="End this workout?"
                message="Sets you've done are saved to your history. Linked habits are only checked off when you reach the end."
                actions={confirmActions(
                    () => setConfirmEnd(false),
                    'End workout',
                    () => {
                        setConfirmEnd(false);
                        act(endSession);
                    },
                    true,
                )}
            />
        </BaseScreen>
    );
};

// ---- Live workout ------------------------------------------------------------------

interface LiveViewProps {
    session: WorkoutSession;
    now: number;
    act: (change: (s: WorkoutSession, now: number) => WorkoutSession) => void;
}

const LiveView: React.FC<LiveViewProps> = ({ session, now, act }) => {
    const { colors } = useTheme().theme;
    const exercise = currentExercise(session);
    const timer = countdown(session, now);
    const upcoming = nextUp(session);
    const setsTotal = totalSets(session.exercises);
    if (!exercise) {
        return null;
    }

    const timed = exercise.mode === 'time';
    const color =
        timer?.kind === 'rest' ? colors.primaryGreen : timer?.kind === 'leadIn' ? colors.warning : colors.accent;

    const label =
        session.phase === 'rest'
            ? 'Rest'
            : timer?.kind === 'leadIn'
            ? 'Get ready'
            : timer?.kind === 'work'
            ? 'Hold'
            : timed
            ? 'Ready'
            : `Set ${session.set + 1}`;

    const big = timer
        ? timer.kind === 'leadIn'
            ? String(secondsLeft(timer.remainingMs))
            : formatCountdown(timer.remainingMs)
        : timed
        ? formatSeconds(exercise.seconds)
        : String(exercise.reps);

    const caption =
        session.phase === 'rest'
            ? upcoming
                ? `Next · ${upcoming.exercise.name} · ${describeTarget(upcoming.exercise)}`
                : 'Last set done'
            : timer?.kind === 'leadIn'
            ? exercise.name
            : timed
            ? timer
                ? `${exercise.name} · set ${session.set + 1} of ${exercise.sets}`
                : 'You get 5 seconds to get set'
            : 'reps';

    const progress = timer
        ? 1 - timer.remainingMs / Math.max(1, timer.totalMs)
        : session.set / Math.max(1, exercise.sets);

    return (
        <ScrollView contentContainerStyle={styles.live}>
            <View style={styles.overall}>
                <ThemedText size="tiny" weight="strong" color="muted" caps tabular>
                    {session.setsDone} of {setsTotal} sets · {formatClock(now - session.startedAt)}
                </ThemedText>
                <ProgressBar fraction={session.setsDone / Math.max(1, setsTotal)} style={styles.overallBar} />
            </View>

            <ThemedText size="xlarge" weight="bold" align="center" style={styles.exerciseName}>
                {exercise.name}
            </ThemedText>
            <View style={styles.setDots}>
                {Array.from({ length: exercise.sets }, (_, i) => (
                    <View
                        key={i}
                        style={[
                            styles.setDot,
                            {
                                backgroundColor:
                                    i < session.set || (i === session.set && session.phase === 'rest')
                                        ? colors.accent
                                        : i === session.set
                                        ? colors.accentSoft
                                        : colors.elevated,
                            },
                        ]}
                    />
                ))}
            </View>
            <ThemedText size="small" color="muted" align="center" tabular>
                Set {session.set + 1} of {exercise.sets} · {describeTarget(exercise)}
            </ThemedText>

            <View style={styles.ringWrap}>
                <ProgressRing
                    size={RING_SIZE}
                    strokeWidth={6}
                    color={color}
                    progress={Math.max(0, Math.min(1, progress))}>
                    <ThemedText size="small" weight="strong" caps style={{ color }}>
                        {label}
                    </ThemedText>
                    <ThemedText size="hero" weight="light" tabular style={styles.clock}>
                        {big}
                    </ThemedText>
                    <ThemedText size="small" color="muted" align="center" style={styles.caption}>
                        {caption}
                    </ThemedText>
                </ProgressRing>
            </View>

            <View style={styles.controls}>
                {session.phase === 'rest' ? (
                    <View style={styles.controlRow}>
                        <Button
                            label="+15 s"
                            variant="secondary"
                            onPress={() => act(s => extendRest(s, 15))}
                            style={styles.flex}
                        />
                        <Button
                            label="Skip rest"
                            icon="Skip"
                            iconLeading
                            onPress={() => act(skipRest)}
                            style={[styles.flex, styles.gap]}
                        />
                    </View>
                ) : session.phase === 'work' ? (
                    <Button
                        label="Done early"
                        icon="Check"
                        iconLeading
                        variant="secondary"
                        onPress={() => act(completeSet)}
                    />
                ) : (
                    <>
                        <Button
                            label={timed ? `Start · ${formatSeconds(exercise.seconds)}` : 'Set done'}
                            icon={timed ? 'Play' : 'Check'}
                            iconLeading
                            onPress={() => act(timed ? startTimedSet : completeSet)}
                            style={styles.mainButton}
                        />
                        <Button label="Skip this set" variant="ghost" onPress={() => act(skipSet)} />
                    </>
                )}
            </View>
        </ScrollView>
    );
};

// ---- Summary -----------------------------------------------------------------------

const SummaryView: React.FC<{ summary: FinishedWorkout; onDone: () => void }> = ({ summary, onDone }) => {
    const { record, habits } = summary;
    const saved = record.setsDone > 0;
    return (
        <ScrollView contentContainerStyle={styles.summary}>
            <FadeIn>
                <Card>
                    <View style={styles.summaryHead}>
                        <IconTile
                            icon={record.completed ? 'Selected' : 'Timer'}
                            tone={record.completed ? 'success' : 'neutral'}
                        />
                        <View style={styles.flex}>
                            <ThemedText weight="strong">
                                {record.completed ? 'Workout complete' : 'Workout ended'}
                            </ThemedText>
                            <ThemedText size="small" color="muted">
                                {saved ? 'Saved to your history' : 'No sets done, so nothing was saved'}
                            </ThemedText>
                        </View>
                    </View>
                    <KeyValueRow label="Sets done" value={`${record.setsDone} of ${record.setsTotal}`} />
                    <KeyValueRow label="Time" value={formatClock(record.endedAt - record.startedAt)} />
                    {habits.map(title => (
                        <KeyValueRow key={title} label="Habit checked off" value={title} />
                    ))}
                </Card>
            </FadeIn>
            <Button label="Done" onPress={onDone} style={styles.done} />
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    flex: {
        flex: 1,
    },
    gap: {
        marginLeft: spacing.sm,
    },
    live: {
        flexGrow: 1,
        paddingHorizontal: gutter,
        paddingBottom: spacing.xl,
    },
    overall: {
        marginTop: spacing.sm,
    },
    overallBar: {
        marginTop: spacing.sm,
    },
    exerciseName: {
        marginTop: spacing.xl,
    },
    setDots: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 6,
        marginTop: spacing.sm,
        marginBottom: spacing.xs,
    },
    setDot: {
        width: 22,
        height: 6,
        borderRadius: 3,
    },
    ringWrap: {
        alignItems: 'center',
        marginTop: spacing.lg,
    },
    clock: {
        marginVertical: 2,
    },
    caption: {
        maxWidth: RING_SIZE - 56,
    },
    controls: {
        marginTop: 'auto',
        paddingTop: spacing.xl,
    },
    controlRow: {
        flexDirection: 'row',
    },
    mainButton: {
        marginBottom: spacing.xs,
    },
    summary: {
        paddingBottom: spacing.xl,
    },
    summaryHead: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm + 2,
        marginBottom: spacing.sm,
    },
    done: {
        marginHorizontal: gutter,
        marginTop: spacing.lg,
    },
});

export default WorkoutSessionScreen;
