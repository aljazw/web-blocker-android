import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { CustomTable, Difficulty, RootStackNavigation, RootStackParamList, TableRound } from '../types/types';
import BackButton from '../components/BackButton';
import BaseScreen from '../components/BaseScreen';
import Button from '../components/Button';
import Card from '../components/Card';
import Dialog, { confirmActions } from '../components/Dialog';
import ErrorPopup from '../components/ErrorPopup';
import IconButton from '../components/IconButton';
import SectionHeader from '../components/SectionHeader';
import Segmented from '../components/Segmented';
import Stepper from '../components/Stepper';
import { ThemedText } from '../components/ThemedText';
import { ThemedView } from '../components/ThemedView';
import { useTheme } from '../context/ThemeContext';
import { useApneaData } from '../hooks/useApneaData';
import { useStartSession } from '../hooks/useApneaSession';
import { gutter, shapes, spacing } from '../theme';
import {
    co2Table,
    DIFFICULTY,
    formatClock,
    formatMinutes,
    MIN_HOLD,
    o2Table,
    personalBest,
    ROUNDS,
    tableDuration,
    tablePhases,
} from '../utils/apnea';
import { newId } from '../utils/dates';
import { deleteCustomTable, saveCustomTable } from '../utils/storage';
import { haptics } from '../utils/haptics';
import { ERRORS } from '../constants/strings';
import { TABLE_INFO } from '../constants/apnea';

const DIFFICULTIES = (Object.keys(DIFFICULTY) as Difficulty[]).map(value => ({
    value,
    label: DIFFICULTY[value].label,
}));

/** A sensible starting point for a new custom table. */
const STARTER_ROUNDS: TableRound[] = Array.from({ length: 6 }, () => ({ breathe: 90, hold: 60 }));
const MAX_CUSTOM_ROUNDS = 20;
const MAX_TIME = 15 * 60;
const MAX_NAME = 40;

type Dialog = { kind: 'delete' } | { kind: 'error' };

const ApneaTableScreen: React.FC = () => {
    const { theme } = useTheme();
    const navigation = useNavigation<RootStackNavigation>();
    const { params } = useRoute<RouteProp<RootStackParamList, 'ApneaTable'>>();
    const { records, tables, settings, loaded, changeSettings } = useApneaData();
    const startSession = useStartSession();
    const [dialog, setDialog] = useState<Dialog | null>(null);

    const isCustom = params.kind === 'custom';
    const tableId = params.kind === 'custom' ? params.tableId : undefined;
    const existing = tables.find(t => t.id === tableId);

    // Custom table being edited (local until saved or started).
    const [name, setName] = useState('');
    const [custom, setCustom] = useState<TableRound[]>(STARTER_ROUNDS);
    const [initialised, setInitialised] = useState(!tableId);
    useEffect(() => {
        if (!initialised && existing) {
            setName(existing.name);
            setCustom(existing.rounds);
            setInitialised(true);
        }
    }, [existing, initialised]);

    const best = useMemo(() => personalBest(records), [records]);
    const bestSec = best ? Math.round(best.ms / 1000) : 0;

    const rounds = useMemo(() => {
        if (params.kind === 'co2') {
            return co2Table(bestSec, settings.difficulty, settings.rounds);
        }
        if (params.kind === 'o2') {
            return o2Table(bestSec, settings.difficulty, settings.rounds);
        }
        return custom;
    }, [params.kind, bestSec, settings.difficulty, settings.rounds, custom]);

    const info = TABLE_INFO[params.kind];
    const title = isCustom ? existing?.name ?? 'New table' : info.title;
    const trimmedName = name.trim() || 'Custom table';

    /** Saves the custom table; returns its id, or null on failure. */
    const persistCustom = async (): Promise<string | null> => {
        const table: CustomTable = { id: existing?.id ?? newId('t'), name: trimmedName, rounds: custom };
        return (await saveCustomTable(table)) ? table.id : null;
    };

    const start = async () => {
        if (isCustom && !(await persistCustom())) {
            setDialog({ kind: 'error' });
            return;
        }
        const ok = await startSession(
            { kind: params.kind, title: isCustom ? trimmedName : info.title, phases: tablePhases(rounds) },
            settings,
        );
        if (!ok) {
            setDialog({ kind: 'error' });
        }
    };

    const save = async () => {
        if (await persistCustom()) {
            haptics.success();
            navigation.goBack();
        } else {
            setDialog({ kind: 'error' });
        }
    };

    const remove = async () => {
        if (existing && (await deleteCustomTable(existing.id))) {
            navigation.goBack();
        } else {
            setDialog({ kind: 'error' });
        }
    };

    const editRound = (index: number, change: Partial<TableRound>) =>
        setCustom(prev => prev.map((r, i) => (i === index ? { ...r, ...change } : r)));

    // Leave if what this screen needs is gone (personal best or table deleted elsewhere).
    const missingBest = loaded && ((!isCustom && !best) || (!!tableId && !existing));
    useEffect(() => {
        if (missingBest) {
            navigation.goBack();
        }
    }, [missingBest, navigation]);

    return (
        <BaseScreen
            title={title}
            subtitle={isCustom ? 'Custom table' : `Based on your best of ${formatClock(best?.ms ?? 0)}`}
            headerLeft={<BackButton />}
            headerRight={
                existing ? (
                    <IconButton
                        icon="Trash"
                        variant="outline"
                        accessibilityLabel="Delete table"
                        onPress={() => setDialog({ kind: 'delete' })}
                    />
                ) : undefined
            }
            isLoading={!loaded || !initialised || missingBest}>
            <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
                <Card>
                    <ThemedText size="small" color="muted">
                        {info.summary}
                    </ThemedText>
                    <View style={[styles.totals, { borderTopColor: theme.colors.border }]}>
                        <Total label="Rounds" value={String(rounds.length)} />
                        <Total label="Duration" value={formatMinutes(tableDuration(rounds))} />
                        <Total
                            label="Total hold"
                            value={formatClock(rounds.reduce((sum, r) => sum + r.hold, 0) * 1000)}
                        />
                    </View>
                </Card>

                {isCustom ? (
                    <>
                        <SectionHeader title="Name" />
                        <TextInput
                            value={name}
                            onChangeText={text => setName(text.slice(0, MAX_NAME))}
                            placeholder="Custom table"
                            placeholderTextColor={theme.colors.muted}
                            selectionColor={theme.colors.accent}
                            style={[
                                styles.nameInput,
                                {
                                    color: theme.colors.text,
                                    borderColor: theme.colors.border,
                                    backgroundColor: theme.colors.card,
                                },
                            ]}
                        />
                    </>
                ) : (
                    <>
                        <SectionHeader title="Difficulty" />
                        <View style={styles.gutter}>
                            <Segmented
                                options={DIFFICULTIES}
                                value={settings.difficulty}
                                onChange={difficulty => changeSettings({ difficulty })}
                            />
                        </View>
                        <Card style={styles.roundsCard}>
                            <ThemedText weight="medium">Rounds</ThemedText>
                            <Stepper
                                value={settings.rounds}
                                min={ROUNDS.min}
                                max={ROUNDS.max}
                                onChange={value => changeSettings({ rounds: value })}
                                accessibilityLabel="rounds"
                            />
                        </Card>
                    </>
                )}

                <SectionHeader title="Rounds" />
                <ThemedView withBorder style={styles.table}>
                    <View style={[styles.tableRow, styles.tableHead, { borderBottomColor: theme.colors.border }]}>
                        <ThemedText size="tiny" weight="strong" color="muted" caps style={styles.roundCol}>
                            #
                        </ThemedText>
                        <ThemedText size="tiny" weight="strong" color="muted" caps style={styles.timeCol}>
                            Breathe
                        </ThemedText>
                        <ThemedText size="tiny" weight="strong" color="muted" caps style={styles.timeCol}>
                            Hold
                        </ThemedText>
                        {isCustom && <View style={styles.removeCol} />}
                    </View>
                    {rounds.map((round, i) => (
                        <View
                            key={i}
                            style={[
                                styles.tableRow,
                                i > 0 && {
                                    borderTopColor: theme.colors.border,
                                    borderTopWidth: StyleSheet.hairlineWidth,
                                },
                            ]}>
                            <ThemedText size="small" color="muted" tabular style={styles.roundCol}>
                                {i + 1}
                            </ThemedText>
                            {isCustom ? (
                                <>
                                    <View style={styles.timeCol}>
                                        <Stepper
                                            compact
                                            value={round.breathe}
                                            min={0}
                                            max={MAX_TIME}
                                            step={5}
                                            format={v => formatClock(v * 1000)}
                                            onChange={v => editRound(i, { breathe: v })}
                                            accessibilityLabel={`round ${i + 1} breathe time`}
                                        />
                                    </View>
                                    <View style={styles.timeCol}>
                                        <Stepper
                                            compact
                                            value={round.hold}
                                            min={MIN_HOLD}
                                            max={MAX_TIME}
                                            step={5}
                                            format={v => formatClock(v * 1000)}
                                            onChange={v => editRound(i, { hold: v })}
                                            accessibilityLabel={`round ${i + 1} hold time`}
                                        />
                                    </View>
                                    <IconButton
                                        icon="Close"
                                        size={30}
                                        accessibilityLabel={`Remove round ${i + 1}`}
                                        onPress={() =>
                                            setCustom(prev => (prev.length > 1 ? prev.filter((_, j) => j !== i) : prev))
                                        }
                                        style={[styles.removeCol, custom.length <= 1 && styles.hidden]}
                                    />
                                </>
                            ) : (
                                <>
                                    <ThemedText tabular style={styles.timeCol}>
                                        {formatClock(round.breathe * 1000)}
                                    </ThemedText>
                                    <ThemedText weight="strong" tabular style={styles.timeCol}>
                                        {formatClock(round.hold * 1000)}
                                    </ThemedText>
                                </>
                            )}
                        </View>
                    ))}
                </ThemedView>
                {isCustom && custom.length < MAX_CUSTOM_ROUNDS && (
                    <Button
                        label="Add round"
                        icon="Plus"
                        iconLeading
                        variant="secondary"
                        compact
                        onPress={() => setCustom(prev => [...prev, prev[prev.length - 1] ?? STARTER_ROUNDS[0]])}
                        style={styles.addRound}
                    />
                )}

                <View style={styles.actions}>
                    <Button label="Start session" icon="Play" iconLeading onPress={start} />
                    {isCustom && (
                        <Button label="Save table" variant="secondary" onPress={save} style={styles.saveButton} />
                    )}
                </View>
            </ScrollView>

            <Dialog
                visible={dialog?.kind === 'delete'}
                onClose={() => setDialog(null)}
                icon="Trash"
                tone="danger"
                title={`Delete “${existing?.name ?? ''}”?`}
                message="Your history from this table is kept."
                actions={confirmActions(() => setDialog(null), 'Delete', remove, true)}
            />
            <ErrorPopup {...ERRORS.saveFailed} visible={dialog?.kind === 'error'} onClose={() => setDialog(null)} />
        </BaseScreen>
    );
};

const Total: React.FC<{ label: string; value: string }> = ({ label, value }) => (
    <View style={styles.total}>
        <ThemedText size="tiny" weight="strong" color="muted" caps>
            {label}
        </ThemedText>
        <ThemedText size="large" weight="bold" tabular style={styles.totalValue}>
            {value}
        </ThemedText>
    </View>
);

const styles = StyleSheet.create({
    scroll: {
        paddingBottom: spacing.xl,
    },
    gutter: {
        marginHorizontal: gutter,
    },
    totals: {
        flexDirection: 'row',
        marginTop: spacing.md,
        paddingTop: spacing.md,
        borderTopWidth: StyleSheet.hairlineWidth,
    },
    total: {
        flex: 1,
    },
    totalValue: {
        marginTop: 2,
    },
    roundsCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: spacing.sm,
    },
    nameInput: {
        marginHorizontal: gutter,
        height: 48,
        borderWidth: 1,
        borderRadius: shapes.borderRadius.medium,
        paddingHorizontal: spacing.md,
        fontSize: 15,
    },
    table: {
        marginHorizontal: gutter,
        borderRadius: shapes.borderRadius.large,
        overflow: 'hidden',
    },
    tableHead: {
        paddingVertical: spacing.sm,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    tableRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        minHeight: 44,
    },
    roundCol: {
        width: 28,
    },
    timeCol: {
        flex: 1,
    },
    removeCol: {
        width: 30,
    },
    hidden: {
        opacity: 0,
    },
    addRound: {
        marginHorizontal: gutter,
        marginTop: spacing.sm,
    },
    actions: {
        marginHorizontal: gutter,
        marginTop: spacing.xl,
    },
    saveButton: {
        marginTop: spacing.sm,
    },
});

export default ApneaTableScreen;
