import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { CustomTable, RootStackNavigation, RootStackParamList, TableParams, TableRound } from '../types/types';
import BackButton from '../components/BackButton';
import BaseScreen from '../components/BaseScreen';
import Button from '../components/Button';
import Card from '../components/Card';
import Dialog, { confirmActions } from '../components/Dialog';
import ErrorPopup from '../components/ErrorPopup';
import IconButton from '../components/IconButton';
import SectionHeader from '../components/SectionHeader';
import { ListGroup, ListRow } from '../components/ListGroup';
import Stepper from '../components/Stepper';
import { ThemedText } from '../components/ThemedText';
import { ThemedView } from '../components/ThemedView';
import { useTheme } from '../context/ThemeContext';
import { useApneaData } from '../hooks/useApneaData';
import { useStartSession } from '../hooks/useApneaSession';
import { gutter, shapes, spacing } from '../theme';
import {
    DEFAULT_TABLE_PARAMS,
    formatClock,
    formatMinutes,
    generateTable,
    MIN_HOLD,
    paramsFromBest,
    personalBest,
    TABLE_LIMITS,
    tableDuration,
    tablePhases,
} from '../utils/apnea';
import { newId } from '../utils/dates';
import { deleteCustomTable, saveCustomTable } from '../utils/storage';
import { haptics } from '../utils/haptics';
import { ERRORS } from '../constants/strings';
import { TABLE_INFO } from '../constants/apnea';

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
    const [name, setName] = useState(params.kind === 'custom' ? params.name ?? '' : '');
    const [custom, setCustom] = useState<TableRound[]>(
        params.kind === 'custom' && params.rounds?.length ? params.rounds : STARTER_ROUNDS,
    );
    const [initialised, setInitialised] = useState(!tableId);
    useEffect(() => {
        if (!initialised && existing) {
            setName(existing.name);
            setCustom(existing.rounds);
            setInitialised(true);
        }
    }, [existing, initialised]);

    const best = useMemo(() => personalBest(records), [records]);

    const tableParams = params.kind === 'custom' ? null : settings[params.kind];
    const rounds = useMemo(
        () => (params.kind === 'custom' || !tableParams ? custom : generateTable(params.kind, tableParams)),
        [params.kind, tableParams, custom],
    );

    /** Changes one parameter of the generated table; saved for next time. */
    const setParam = (change: Partial<TableParams>) => {
        if (params.kind !== 'custom' && tableParams) {
            changeSettings({ [params.kind]: { ...tableParams, ...change } });
        }
    };

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

    // Leave if the table was deleted elsewhere.
    const missing = loaded && !!tableId && !existing;
    useEffect(() => {
        if (missing) {
            navigation.goBack();
        }
    }, [missing, navigation]);

    return (
        <BaseScreen
            title={title}
            subtitle={
                isCustom
                    ? 'Custom table'
                    : params.kind === 'co2'
                    ? 'Fixed hold, shorter breathe each round'
                    : 'Fixed breathe, longer hold each round'
            }
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
            isLoading={!loaded || !initialised || missing}>
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
                    tableParams && (
                        <>
                            <SectionHeader
                                title="Settings"
                                right={
                                    <Button
                                        label="Reset"
                                        variant="ghost"
                                        compact
                                        onPress={() => setParam(DEFAULT_TABLE_PARAMS[params.kind as 'co2' | 'o2'])}
                                        style={styles.headerButton}
                                    />
                                }
                            />
                            <ListGroup>
                                <ParamRow
                                    title={params.kind === 'co2' ? 'Hold' : 'First hold'}
                                    value={tableParams.hold}
                                    limits={TABLE_LIMITS.hold}
                                    onChange={hold => setParam({ hold })}
                                />
                                <ParamRow
                                    title={params.kind === 'co2' ? 'First breathe' : 'Breathe'}
                                    value={tableParams.breathe}
                                    limits={TABLE_LIMITS.breathe}
                                    onChange={breathe => setParam({ breathe })}
                                />
                                <ParamRow
                                    title={params.kind === 'co2' ? 'Breathe shorter by' : 'Hold longer by'}
                                    description="Each round"
                                    value={tableParams.step}
                                    limits={TABLE_LIMITS.step}
                                    onChange={step => setParam({ step })}
                                />
                                <ListRow title="Rounds">
                                    <Stepper
                                        value={tableParams.rounds}
                                        min={TABLE_LIMITS.rounds.min}
                                        max={TABLE_LIMITS.rounds.max}
                                        onChange={value => setParam({ rounds: value })}
                                        accessibilityLabel="rounds"
                                    />
                                </ListRow>
                            </ListGroup>
                            {best && (
                                <Button
                                    label={`Suggest from my best (${formatClock(best.ms)})`}
                                    variant="secondary"
                                    compact
                                    onPress={() =>
                                        setParam(
                                            paramsFromBest(params.kind as 'co2' | 'o2', Math.round(best.ms / 1000)),
                                        )
                                    }
                                    style={styles.addRound}
                                />
                            )}
                        </>
                    )
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

                {!isCustom && (
                    <Button
                        label="Customize rounds individually"
                        icon="Edit"
                        iconLeading
                        variant="ghost"
                        compact
                        onPress={() =>
                            navigation.navigate('ApneaTable', { kind: 'custom', name: `My ${info.title}`, rounds })
                        }
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

const ParamRow: React.FC<{
    title: string;
    description?: string;
    value: number;
    limits: { min: number; max: number };
    onChange: (value: number) => void;
}> = ({ title, description, value, limits, onChange }) => (
    <ListRow title={title} description={description}>
        <Stepper
            value={value}
            min={limits.min}
            max={limits.max}
            step={TABLE_LIMITS.increment}
            format={v => formatClock(v * 1000)}
            onChange={onChange}
            accessibilityLabel={title}
        />
    </ListRow>
);

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
    headerButton: {
        marginVertical: -8,
        marginRight: -spacing.sm,
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
