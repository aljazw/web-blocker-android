import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ApneaRecord, RootStackNavigation } from '../types/types';
import ApneaRecordRow from '../components/ApneaRecordRow';
import BarChart from '../components/BarChart';
import BaseScreen from '../components/BaseScreen';
import Button from '../components/Button';
import Card from '../components/Card';
import Dialog, { confirmActions } from '../components/Dialog';
import DurationInput from '../components/DurationInput';
import ErrorPopup from '../components/ErrorPopup';
import IconButton from '../components/IconButton';
import IconTile from '../components/IconTile';
import { ListGroup, ListRow } from '../components/ListGroup';
import RecordDetailDialog from '../components/RecordDetailDialog';
import SafetyRules from '../components/SafetyRules';
import SectionHeader from '../components/SectionHeader';
import Segmented from '../components/Segmented';
import StatRow from '../components/StatRow';
import StatTile from '../components/StatTile';
import { ThemedText } from '../components/ThemedText';
import { FadeIn } from '../components/Motion';
import Icon from '../components/Icon';
import { useTheme } from '../context/ThemeContext';
import { useApneaData } from '../hooks/useApneaData';
import { useApneaSession, useStartSession } from '../hooks/useApneaSession';
import { gutter, spacing } from '../theme';
import {
    BREATHING_EXERCISES,
    BreathingExercise,
    co2Table,
    exercisePhases,
    formatClock,
    formatMinutes,
    maxHoldHistory,
    maxTestPhases,
    o2Table,
    PHASE_LABEL,
    personalBest,
    tableDuration,
    trainingStats,
} from '../utils/apnea';
import { shortDate, newId } from '../utils/dates';
import { addApneaRecord, deleteApneaRecord } from '../utils/storage';
import { haptics } from '../utils/haptics';
import { ERRORS } from '../constants/strings';
import { APNEA_SAFETY } from '../constants/apnea';

type Dialog =
    | { kind: 'safety' }
    | { kind: 'manualPb' }
    | { kind: 'exercise'; exercise: BreathingExercise }
    | { kind: 'record'; record: ApneaRecord }
    | { kind: 'error' };

const RECENT_COUNT = 5;
const EXERCISE_MINUTES = [
    { value: '2', label: '2 min' },
    { value: '5', label: '5 min' },
    { value: '10', label: '10 min' },
];

const BreatheScreen: React.FC = () => {
    const { theme } = useTheme();
    const navigation = useNavigation<RootStackNavigation>();
    const { records, tables, settings, loaded, reload, changeSettings } = useApneaData();
    const { state: session } = useApneaSession(1000);
    const startSession = useStartSession();
    const [dialog, setDialog] = useState<Dialog | null>(null);
    const close = () => setDialog(null);

    const best = useMemo(() => personalBest(records), [records]);
    const history = useMemo(() => maxHoldHistory(records), [records]);
    const stats = useMemo(() => trainingStats(records), [records]);
    const recent = useMemo(() => [...records].reverse().slice(0, RECENT_COUNT), [records]);
    const bestSec = best ? Math.round(best.ms / 1000) : 0;
    const sessionLive = session?.status === 'running' || session?.status === 'paused';

    // The safety briefing must be acknowledged once before any training.
    const needsSafety = loaded && !settings.safetyAccepted;
    const guard = (action: () => void) => (needsSafety ? setDialog({ kind: 'safety' }) : action());

    const startMaxTest = () =>
        guard(() =>
            startSession({ kind: 'pb', title: 'Max hold', phases: maxTestPhases(settings.breatheUp) }, settings),
        );

    const openTable = (kind: 'co2' | 'o2') =>
        guard(() => (best ? navigation.navigate('ApneaTable', { kind }) : startMaxTest()));

    const deleteRecord = async (record: ApneaRecord) => {
        close();
        if (await deleteApneaRecord(record.id)) {
            reload();
        } else {
            setDialog({ kind: 'error' });
        }
    };

    const tablePreview = (kind: 'co2' | 'o2') => {
        if (!best) {
            return 'Needs a personal best';
        }
        const rounds = (kind === 'co2' ? co2Table : o2Table)(bestSec, settings.difficulty, settings.rounds);
        const holds = rounds.map(r => r.hold);
        const holdText =
            kind === 'co2'
                ? `hold ${formatClock(holds[0] * 1000)}`
                : `hold ${formatClock(holds[0] * 1000)}–${formatClock(holds[holds.length - 1] * 1000)}`;
        return `${rounds.length} rounds · ${formatMinutes(tableDuration(rounds))} · ${holdText}`;
    };

    const currentPhase = session && sessionLive ? session.phases[session.index] : undefined;

    return (
        <BaseScreen
            title="Apnea"
            subtitle="Static breath-hold training"
            headerRight={
                <IconButton
                    icon="Sliders"
                    variant="outline"
                    accessibilityLabel="Training settings"
                    onPress={() => navigation.navigate('ApneaSettings')}
                />
            }>
            <ScrollView contentContainerStyle={styles.scroll}>
                {sessionLive && currentPhase && (
                    <Card onPress={() => navigation.navigate('ApneaSession')} highlight={theme.colors.accent}>
                        <View style={styles.row}>
                            <IconTile icon={session.status === 'paused' ? 'Pause' : 'Play'} tone="accent" />
                            <View style={styles.flex}>
                                <ThemedText weight="strong">{session.title} in progress</ThemedText>
                                <ThemedText size="small" color="muted">
                                    {session.status === 'paused' ? 'Paused' : PHASE_LABEL[currentPhase.type]} · round{' '}
                                    {currentPhase.round}
                                </ThemedText>
                            </View>
                            <Icon name="Next" size={18} tint={theme.colors.muted} />
                        </View>
                    </Card>
                )}

                {/* ---- Personal best ---- */}
                <FadeIn>
                    <Card>
                        <ThemedText size="tiny" weight="strong" color="muted" caps>
                            Personal best
                        </ThemedText>
                        {best ? (
                            <>
                                <View style={styles.pbRow}>
                                    <ThemedText size="display" weight="bold" tabular>
                                        {formatClock(best.ms)}
                                    </ThemedText>
                                    <ThemedText size="small" color="muted" style={styles.pbDate}>
                                        {best.record.manual ? 'Entered' : 'Set'}{' '}
                                        {shortDate(new Date(best.record.startedAt))}
                                    </ThemedText>
                                </View>
                                {history.length > 1 && (
                                    <BarChart values={history.slice(-14).map(h => h.ms)} formatValue={formatClock} />
                                )}
                            </>
                        ) : (
                            <ThemedText color="muted" style={styles.pbEmpty}>
                                Measure your maximum static breath-hold. Your CO₂ and O₂ tables are calculated from it.
                            </ThemedText>
                        )}
                        <View style={styles.buttons}>
                            <Button
                                label="Max hold test"
                                icon="Timer"
                                iconLeading
                                onPress={startMaxTest}
                                style={styles.flex}
                            />
                            <Button
                                label="Enter time"
                                variant="secondary"
                                onPress={() => guard(() => setDialog({ kind: 'manualPb' }))}
                                style={styles.secondaryButton}
                            />
                        </View>
                    </Card>
                </FadeIn>

                {records.length > 0 && (
                    <FadeIn delay={40}>
                        <StatRow>
                            <StatTile label="This week" value={stats.sessionsThisWeek} suffix=" sessions" />
                            <StatTile label="Hold time" value={formatClock(stats.holdMsThisWeek)} />
                            <StatTile label="Streak" value={stats.streakDays} suffix=" d" />
                        </StatRow>
                    </FadeIn>
                )}

                {/* ---- Tables ---- */}
                <SectionHeader title="Tables" />
                <ListGroup>
                    <ListRow
                        icon="Timer"
                        title="CO₂ table"
                        description={tablePreview('co2')}
                        onPress={() => openTable('co2')}
                    />
                    <ListRow
                        icon="Hourglass"
                        title="O₂ table"
                        description={tablePreview('o2')}
                        onPress={() => openTable('o2')}
                    />
                    {tables.map(table => (
                        <ListRow
                            key={table.id}
                            icon="Sliders"
                            title={table.name}
                            description={`${table.rounds.length} rounds · ${formatMinutes(
                                tableDuration(table.rounds),
                            )}`}
                            onPress={() =>
                                guard(() => navigation.navigate('ApneaTable', { kind: 'custom', tableId: table.id }))
                            }
                        />
                    ))}
                    <ListRow
                        icon="Plus"
                        title="Build a custom table"
                        description="Set your own rest and hold times"
                        onPress={() => guard(() => navigation.navigate('ApneaTable', { kind: 'custom' }))}
                    />
                </ListGroup>

                {/* ---- Breathing ---- */}
                <SectionHeader title="Breathing exercises" />
                <ListGroup>
                    {BREATHING_EXERCISES.map(exercise => (
                        <ListRow
                            key={exercise.id}
                            icon="Wind"
                            title={exercise.name}
                            description={exercise.rhythm}
                            onPress={() => guard(() => setDialog({ kind: 'exercise', exercise }))}
                        />
                    ))}
                </ListGroup>

                {/* ---- History ---- */}
                {recent.length > 0 && (
                    <>
                        <SectionHeader
                            title="Recent"
                            right={
                                records.length > RECENT_COUNT ? (
                                    <Button
                                        label="See all"
                                        variant="ghost"
                                        compact
                                        onPress={() => navigation.navigate('ApneaHistory')}
                                        style={styles.seeAll}
                                    />
                                ) : undefined
                            }
                        />
                        <ListGroup>
                            {recent.map(record => (
                                <ApneaRecordRow
                                    key={record.id}
                                    record={record}
                                    isBest={best?.record.id === record.id}
                                    onPress={() => setDialog({ kind: 'record', record })}
                                />
                            ))}
                        </ListGroup>
                    </>
                )}

                <View style={styles.safetyNote}>
                    <Icon name="Info" size={14} tint={theme.colors.muted} />
                    <ThemedText size="small" color="muted" style={styles.safetyText}>
                        Dry training only. Never practise breath-holds in water without a qualified buddy.
                    </ThemedText>
                </View>
            </ScrollView>

            <Dialog
                visible={dialog?.kind === 'safety'}
                onClose={close}
                icon="Alert"
                tone="danger"
                title={APNEA_SAFETY.title}
                dismissable={false}
                message={<SafetyRules />}
                actions={[
                    { label: 'Not now', onPress: close, variant: 'secondary' },
                    {
                        label: 'I understand',
                        onPress: async () => {
                            await changeSettings({ safetyAccepted: true });
                            close();
                        },
                    },
                ]}
            />

            <ManualPbDialog
                visible={dialog?.kind === 'manualPb'}
                onClose={close}
                onSave={async ms => {
                    const now = Date.now();
                    const ok = await addApneaRecord({
                        id: newId('a'),
                        kind: 'pb',
                        title: 'Max hold',
                        startedAt: now,
                        endedAt: now,
                        completed: true,
                        holds: [ms],
                        targets: [-1],
                        contractions: [[]],
                        planned: 1,
                        manual: true,
                    });
                    if (!ok) {
                        setDialog({ kind: 'error' });
                        return;
                    }
                    haptics.success();
                    close();
                    reload();
                }}
            />

            <ExerciseDialog
                exercise={dialog?.kind === 'exercise' ? dialog.exercise : null}
                onClose={close}
                onStart={(exercise, minutes) => {
                    close();
                    startSession(
                        { kind: 'breathing', title: exercise.name, phases: exercisePhases(exercise, minutes) },
                        settings,
                    );
                }}
            />

            <RecordDetailDialog
                record={dialog?.kind === 'record' ? dialog.record : null}
                onClose={close}
                onDelete={deleteRecord}
            />

            <ErrorPopup {...ERRORS.saveFailed} visible={dialog?.kind === 'error'} onClose={close} />
        </BaseScreen>
    );
};

const ManualPbDialog: React.FC<{ visible: boolean; onClose: () => void; onSave: (ms: number) => Promise<void> }> = ({
    visible,
    onClose,
    onSave,
}) => {
    const [minutes, setMinutes] = useState('');
    const [seconds, setSeconds] = useState('');
    const ms = (Number(minutes || 0) * 60 + Number(seconds || 0)) * 1000;

    return (
        <Dialog
            visible={visible}
            onClose={onClose}
            title="Enter a breath-hold time"
            message="Record a maximum hold you timed elsewhere, such as with a buddy or instructor."
            actions={confirmActions(onClose, 'Save', async () => {
                if (ms < 10_000) {
                    return;
                }
                await onSave(ms);
                setMinutes('');
                setSeconds('');
            })}>
            <View style={styles.durationInput}>
                <DurationInput
                    minutes={minutes}
                    seconds={seconds}
                    onChange={(m, s) => {
                        setMinutes(m);
                        setSeconds(s);
                    }}
                />
                {ms > 0 && ms < 10_000 && (
                    <ThemedText size="small" color="primaryRed" style={styles.inputHint}>
                        Enter at least 10 seconds.
                    </ThemedText>
                )}
            </View>
        </Dialog>
    );
};

const ExerciseDialog: React.FC<{
    exercise: BreathingExercise | null;
    onClose: () => void;
    onStart: (exercise: BreathingExercise, minutes: number) => void;
}> = ({ exercise, onClose, onStart }) => {
    const [minutes, setMinutes] = useState('5');
    return (
        <Dialog
            visible={exercise !== null}
            onClose={onClose}
            icon="Wind"
            title={exercise?.name ?? ''}
            message={exercise?.description}
            actions={confirmActions(onClose, 'Start', () => {
                if (exercise) {
                    onStart(exercise, Number(minutes));
                }
            })}>
            <ThemedText size="tiny" weight="strong" color="muted" caps style={styles.durationLabel}>
                Duration
            </ThemedText>
            <Segmented options={EXERCISE_MINUTES} value={minutes} onChange={setMinutes} />
        </Dialog>
    );
};

const styles = StyleSheet.create({
    scroll: {
        paddingBottom: spacing.xl,
    },
    flex: {
        flex: 1,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm + 2,
    },
    pbRow: {
        flexDirection: 'row',
        alignItems: 'baseline',
        marginTop: spacing.xs,
    },
    pbDate: {
        marginLeft: spacing.sm,
    },
    pbEmpty: {
        marginTop: spacing.sm,
    },
    buttons: {
        flexDirection: 'row',
        marginTop: spacing.md,
    },
    secondaryButton: {
        marginLeft: spacing.sm,
    },
    seeAll: {
        marginVertical: -8,
        marginRight: -spacing.md,
    },
    safetyNote: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginHorizontal: gutter + 2,
        marginTop: spacing.xl,
    },
    safetyText: {
        flex: 1,
        marginLeft: spacing.sm - 2,
        marginTop: -2,
    },
    durationInput: {
        marginTop: spacing.md,
    },
    inputHint: {
        marginTop: spacing.sm,
    },
    durationLabel: {
        marginTop: spacing.md,
        marginBottom: spacing.sm - 2,
    },
});

export default BreatheScreen;
