import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, ScrollView, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ApneaRecord } from '../types/types';
import BaseScreen from '../components/BaseScreen';
import Button from '../components/Button';
import Card from '../components/Card';
import Dialog, { confirmActions } from '../components/Dialog';
import IconButton from '../components/IconButton';
import IconTile from '../components/IconTile';
import ProgressRing from '../components/ProgressRing';
import { RecordBreakdown } from '../components/RecordDetailDialog';
import { ThemedText } from '../components/ThemedText';
import { FadeIn } from '../components/Motion';
import { useTheme } from '../context/ThemeContext';
import { useApneaSession } from '../hooks/useApneaSession';
import { gutter, spacing } from '../theme';
import {
    formatClock,
    formatCountdown,
    longestHold,
    PHASE_LABEL,
    PhaseType,
    personalBest,
    recordFromSession,
    SessionPhase,
    SessionState,
} from '../utils/apnea';
import { apneaSession, collectFinishedSession } from '../utils/apneaSession';
import { getApneaRecords } from '../utils/storage';
import { haptics } from '../utils/haptics';
import { logger } from '../utils/logger';

const RING_SIZE = 268;
const BREATHING_TYPES: PhaseType[] = ['inhale', 'holdIn', 'exhale', 'holdOut'];

interface Summary {
    record: ApneaRecord;
    saved: boolean;
    newBest: boolean;
}

const ApneaSessionScreen: React.FC = () => {
    const navigation = useNavigation();
    const session = useApneaSession();
    const { state } = session;
    const [summary, setSummary] = useState<Summary | null>(null);
    const [confirmEnd, setConfirmEnd] = useState(false);
    /** Personal best before this session, to recognise a new one. null = not loaded yet. */
    const [bestBefore, setBestBefore] = useState<number | null>(null);
    /** Set once the result is being collected, so a re-render can't collect it twice. */
    const collecting = useRef(false);

    useEffect(() => {
        apneaSession.setKeepAwake(true);
        getApneaRecords()
            .then(records => setBestBefore(personalBest(records)?.ms ?? 0))
            .catch(() => setBestBefore(0));
        return () => apneaSession.setKeepAwake(false);
    }, []);

    // Once finished: save the result (exactly once) and switch to the summary.
    const finished = state?.status === 'finished';
    useEffect(() => {
        if (!finished || !state || collecting.current || bestBefore === null) {
            return;
        }
        collecting.current = true;
        collectFinishedSession()
            .then(saved => {
                const record = saved ?? recordFromSession(state);
                if (!record) {
                    navigation.goBack();
                    return;
                }
                const newBest = record.kind === 'pb' && longestHold(record) > bestBefore;
                if (newBest || record.completed) {
                    haptics.success();
                }
                setSummary({ record, saved: saved !== null, newBest });
            })
            .catch(error => logger.warn('Could not finish session', error));
    }, [finished, state, bestBefore, navigation]);

    // Nothing running and nothing to show (e.g. the result was already collected): leave.
    useEffect(() => {
        if (state?.status === 'idle' && !summary) {
            navigation.goBack();
        }
    }, [state?.status, summary, navigation]);

    const live = state?.status === 'running' || state?.status === 'paused';

    return (
        <BaseScreen
            title={summary?.record.title ?? state?.title ?? ''}
            subtitle={summary ? 'Summary' : state?.status === 'paused' ? 'Paused' : 'Keeps running with the app closed'}
            headerRight={
                <IconButton
                    icon="Close"
                    variant="outline"
                    accessibilityLabel={live ? 'End session' : 'Close'}
                    onPress={() => (live ? setConfirmEnd(true) : navigation.goBack())}
                />
            }
            isLoading={!state || (finished && !summary)}>
            {summary ? (
                <SummaryView summary={summary} onDone={() => navigation.goBack()} />
            ) : state && live ? (
                <LiveView session={session} state={state} bestBefore={bestBefore ?? 0} />
            ) : null}

            <Dialog
                visible={confirmEnd}
                onClose={() => setConfirmEnd(false)}
                icon="Stop"
                tone="danger"
                title="End this session?"
                message="Rounds you've completed are saved to your history."
                actions={confirmActions(
                    () => setConfirmEnd(false),
                    'End session',
                    async () => {
                        setConfirmEnd(false);
                        await session.stop();
                    },
                    true,
                )}
            />
        </BaseScreen>
    );
};

// ---- Live session ------------------------------------------------------------------

interface LiveViewProps {
    session: ReturnType<typeof useApneaSession>;
    state: SessionState;
    bestBefore: number;
}

const LiveView: React.FC<LiveViewProps> = ({ session, state, bestBefore }) => {
    const { colors } = useTheme().theme;
    const phase = state.phases[state.index] as SessionPhase | undefined;
    const running = state.status === 'running';
    const elapsed = state.phaseElapsedMs + (running ? Date.now() - session.receivedAt.current : 0);

    const isHold = phase?.type === 'hold';
    const isOpen = (phase?.durationMs ?? 0) < 0;
    const isBreathing = !!phase && BREATHING_TYPES.includes(phase.type);
    const isMaxTest = state.kind === 'pb';
    const remaining = isOpen ? 0 : (phase?.durationMs ?? 0) - elapsed;

    const holdIndex = state.contractions.length - 1;
    const contractions = isHold ? state.contractions[holdIndex] ?? [] : [];
    const rounds = Math.max(...state.phases.map(p => p.round), 1);

    const color = !phase
        ? colors.accent
        : phase.type === 'hold' || phase.type === 'inhale'
        ? colors.accent
        : phase.type === 'holdIn' || phase.type === 'holdOut'
        ? colors.warning
        : colors.primaryGreen;

    // The ring animates to the end of each timed phase; re-synced on phase change, pause and resume.
    const progress = useRef(new Animated.Value(0)).current;
    useEffect(() => {
        if (!phase || isOpen) {
            return;
        }
        progress.setValue(Math.min(1, elapsed / phase.durationMs));
        if (running) {
            Animated.timing(progress, {
                toValue: 1,
                duration: Math.max(0, phase.durationMs - elapsed),
                easing: Easing.linear,
                useNativeDriver: false,
            }).start();
        }
        return () => progress.stopAnimation();
        // Deliberately keyed on phase/status only: re-syncing on every poll would make it stutter.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [state.id, state.index, state.status]);

    const next = state.phases[state.index + 1];
    const caption = isOpen
        ? bestBefore > 0
            ? elapsed > bestBefore
                ? `${formatClock(elapsed - bestBefore)} past your best`
                : `Best ${formatClock(bestBefore)}`
            : 'Tap Stop when you breathe'
        : next
        ? `Next · ${PHASE_LABEL[next.type]} ${formatCountdown(next.durationMs)}`
        : 'Last phase';

    const onContraction = () => {
        haptics.tap();
        session.contraction();
    };

    return (
        <ScrollView contentContainerStyle={styles.live}>
            {!isMaxTest && (
                <View style={styles.roundHeader}>
                    <ThemedText size="tiny" weight="strong" color="muted" caps>
                        {isBreathing ? 'Cycle' : 'Round'} {phase?.round ?? rounds} of {rounds}
                    </ThemedText>
                    {!isBreathing && rounds <= 20 && (
                        <View style={styles.segments}>
                            {Array.from({ length: rounds }, (_, i) => {
                                const round = i + 1;
                                const done = phase ? round < phase.round : true;
                                const current = round === phase?.round;
                                return (
                                    <View
                                        key={i}
                                        style={[
                                            styles.segment,
                                            {
                                                backgroundColor: done
                                                    ? colors.accent
                                                    : current
                                                    ? colors.accentSoft
                                                    : colors.elevated,
                                            },
                                        ]}
                                    />
                                );
                            })}
                        </View>
                    )}
                </View>
            )}

            <View style={styles.ringWrap}>
                <ProgressRing
                    size={RING_SIZE}
                    strokeWidth={6}
                    color={isOpen && bestBefore > 0 && elapsed > bestBefore ? colors.primaryGreen : color}
                    progress={isOpen ? (bestBefore > 0 ? Math.min(1, elapsed / bestBefore) : 0) : progress}>
                    {isBreathing && phase && (
                        <BreathingOrb
                            phase={phase}
                            phaseKey={`${state.id}:${state.index}`}
                            elapsed={elapsed}
                            running={running}
                            color={color}
                        />
                    )}
                    <ThemedText size="small" weight="strong" caps style={{ color }}>
                        {phase ? PHASE_LABEL[phase.type] : ''}
                    </ThemedText>
                    <ThemedText size="hero" weight="light" tabular style={styles.clock}>
                        {isOpen ? formatClock(elapsed) : formatCountdown(remaining)}
                    </ThemedText>
                    <ThemedText size="small" color="muted" tabular>
                        {caption}
                    </ThemedText>
                </ProgressRing>
            </View>

            {isHold && (
                <ThemedText color="muted" align="center" tabular style={styles.contractionInfo}>
                    {contractions.length === 0
                        ? 'Tap Contraction at each diaphragm contraction'
                        : `${contractions.length} contraction${
                              contractions.length === 1 ? '' : 's'
                          } · first at ${formatClock(contractions[0])}`}
                </ThemedText>
            )}

            <View style={styles.controls}>
                {state.status === 'paused' ? (
                    <Button label="Resume" icon="Play" iconLeading onPress={session.resume} />
                ) : (
                    <>
                        {isHold && (
                            <Button
                                label={`Contraction${contractions.length ? ` · ${contractions.length}` : ''}`}
                                variant="secondary"
                                onPress={onContraction}
                                style={styles.contractionButton}
                            />
                        )}
                        <View style={styles.controlRow}>
                            <Button
                                label="Pause"
                                icon="Pause"
                                iconLeading
                                variant="secondary"
                                onPress={session.pause}
                                style={styles.flex}
                            />
                            {isHold ? (
                                <Button
                                    label={isOpen ? 'Stop' : 'End hold'}
                                    icon={isOpen ? 'Stop' : 'Skip'}
                                    iconLeading
                                    variant={isOpen ? 'primary' : 'secondary'}
                                    onPress={session.skip}
                                    style={[styles.flex, styles.gap]}
                                />
                            ) : !isBreathing ? (
                                <Button
                                    label="Hold now"
                                    icon="Skip"
                                    iconLeading
                                    variant="secondary"
                                    onPress={session.skip}
                                    style={[styles.flex, styles.gap]}
                                />
                            ) : null}
                        </View>
                    </>
                )}
            </View>
        </ScrollView>
    );
};

/** Expands on inhale, holds, contracts on exhale: a visual pacer for breathing exercises. */
interface BreathingOrbProps {
    phase: SessionPhase;
    /** Identifies the phase; the animation restarts only when this or `running` changes. */
    phaseKey: string;
    elapsed: number;
    running: boolean;
    color: string;
}

const BreathingOrb: React.FC<BreathingOrbProps> = ({ phase, phaseKey, elapsed, running, color }) => {
    const MIN = 0.45;
    const scale = useRef(new Animated.Value(MIN)).current;
    useEffect(() => {
        const from = phase.type === 'inhale' ? MIN : phase.type === 'exhale' ? 1 : phase.type === 'holdIn' ? 1 : MIN;
        const to = phase.type === 'inhale' ? 1 : phase.type === 'exhale' ? MIN : from;
        const t = Math.min(1, elapsed / phase.durationMs);
        scale.setValue(from + (to - from) * t);
        if (running && from !== to) {
            Animated.timing(scale, {
                toValue: to,
                duration: Math.max(0, phase.durationMs - elapsed),
                easing: Easing.inOut(Easing.sin),
                useNativeDriver: true,
            }).start();
        }
        return () => scale.stopAnimation();
        // Keyed on the phase identity, not on every poll, so the animation runs uninterrupted.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [phaseKey, running]);

    return (
        <Animated.View pointerEvents="none" style={[styles.orb, { backgroundColor: color, transform: [{ scale }] }]} />
    );
};

// ---- Summary -----------------------------------------------------------------------

const SummaryView: React.FC<{ summary: Summary; onDone: () => void }> = ({ summary, onDone }) => {
    const { record, saved, newBest } = summary;
    const headline = newBest
        ? 'New personal best'
        : record.kind === 'pb'
        ? 'Max hold'
        : record.completed
        ? 'Session complete'
        : 'Session ended early';
    const value =
        record.kind === 'pb'
            ? formatClock(longestHold(record))
            : record.kind === 'breathing'
            ? formatClock(record.endedAt - record.startedAt)
            : `${record.holds.length}/${record.planned}`;

    return (
        <ScrollView contentContainerStyle={styles.summary}>
            <FadeIn>
                <Card>
                    <IconTile
                        icon={newBest ? 'Trophy' : record.completed ? 'Check' : 'Stop'}
                        tone={newBest || record.completed ? 'success' : 'neutral'}
                        size={44}
                    />
                    <ThemedText size="tiny" weight="strong" color="muted" caps style={styles.summaryEyebrow}>
                        {headline}
                    </ThemedText>
                    <ThemedText size="display" weight="bold" tabular>
                        {value}
                        {record.kind !== 'pb' && record.kind !== 'breathing' && (
                            <ThemedText size="large" color="muted" weight="medium">
                                {' '}
                                rounds
                            </ThemedText>
                        )}
                    </ThemedText>
                    <RecordBreakdown record={record} />
                    {!saved && (
                        <ThemedText size="small" color="muted" style={styles.notSaved}>
                            Too short to add to your history.
                        </ThemedText>
                    )}
                </Card>
                <Button label="Done" onPress={onDone} style={styles.done} />
            </FadeIn>
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
    roundHeader: {
        marginTop: spacing.sm,
    },
    segments: {
        flexDirection: 'row',
        marginTop: spacing.sm,
    },
    segment: {
        flex: 1,
        height: 4,
        borderRadius: 2,
        marginRight: 3,
    },
    ringWrap: {
        alignItems: 'center',
        marginTop: spacing.xl,
    },
    clock: {
        marginVertical: 2,
    },
    orb: {
        position: 'absolute',
        width: RING_SIZE - 48,
        height: RING_SIZE - 48,
        borderRadius: (RING_SIZE - 48) / 2,
        opacity: 0.12,
    },
    contractionInfo: {
        marginTop: spacing.lg,
    },
    controls: {
        marginTop: 'auto',
        paddingTop: spacing.xl,
    },
    contractionButton: {
        marginBottom: spacing.sm,
    },
    controlRow: {
        flexDirection: 'row',
    },
    summary: {
        paddingBottom: spacing.xl,
    },
    summaryEyebrow: {
        marginTop: spacing.md,
        marginBottom: 2,
    },
    notSaved: {
        marginTop: spacing.md,
    },
    done: {
        marginHorizontal: gutter,
        marginTop: spacing.lg,
    },
});

export default ApneaSessionScreen;
