import { ScrollView, StyleSheet, View } from 'react-native';
import { ApneaRecord } from '../types/types';
import { useTheme } from '../context/ThemeContext';
import { spacing } from '../theme';
import { firstContractions, formatClock, formatMinutes, longestHold } from '../utils/apnea';
import { shortDate } from '../utils/dates';
import Dialog from './Dialog';
import { KeyValueRow } from './ListGroup';
import { ThemedText } from './ThemedText';
import { KIND_ICON } from './ApneaRecordRow';

interface RecordDetailDialogProps {
    record: ApneaRecord | null;
    onClose: () => void;
    onDelete: (record: ApneaRecord) => void;
}

/** Full breakdown of one session: totals plus a per-round table. */
const RecordDetailDialog: React.FC<RecordDetailDialogProps> = ({ record, onClose, onDelete }) => {
    const date = record ? new Date(record.startedAt) : new Date();
    return (
        <Dialog
            visible={record !== null}
            onClose={onClose}
            icon={record ? KIND_ICON[record.kind] : undefined}
            title={record?.title ?? ''}
            message={`${shortDate(date)} at ${date.toLocaleTimeString(undefined, {
                hour: '2-digit',
                minute: '2-digit',
            })}`}
            actions={[
                {
                    label: 'Delete',
                    onPress: () => {
                        if (record) {
                            onDelete(record);
                        }
                    },
                    variant: 'danger',
                },
                { label: 'Close', onPress: onClose, variant: 'secondary' },
            ]}>
            {record && <RecordBreakdown record={record} />}
        </Dialog>
    );
};

export const RecordBreakdown: React.FC<{ record: ApneaRecord }> = ({ record }) => {
    const { colors } = useTheme().theme;
    const contractions = record.contractions.reduce((sum, c) => sum + c.length, 0);
    const first = firstContractions(record);
    const totalHold = record.holds.reduce((a, b) => a + b, 0);

    return (
        <View style={styles.wrap}>
            {record.kind === 'breathing' ? (
                <KeyValueRow label="Duration" value={formatMinutes((record.endedAt - record.startedAt) / 1000)} />
            ) : (
                <>
                    {record.kind !== 'pb' && (
                        <KeyValueRow label="Rounds" value={`${record.holds.length} of ${record.planned}`} />
                    )}
                    <KeyValueRow
                        label={record.kind === 'pb' ? 'Hold' : 'Longest hold'}
                        value={formatClock(longestHold(record))}
                    />
                    {record.kind !== 'pb' && <KeyValueRow label="Total hold time" value={formatClock(totalHold)} />}
                    {!record.manual && <KeyValueRow label="Contractions" value={String(contractions)} />}
                    {first.length > 0 && (
                        <KeyValueRow
                            label={record.kind === 'pb' ? 'First contraction' : 'Avg. first contraction'}
                            value={formatClock(first.reduce((a, b) => a + b, 0) / first.length)}
                        />
                    )}
                </>
            )}

            {record.kind !== 'pb' && record.holds.length > 0 && (
                <>
                    <View style={[styles.tableHead, { borderBottomColor: colors.border }]}>
                        {['Round', 'Target', 'Held', '1st contr.'].map(h => (
                            <ThemedText key={h} size="tiny" color="muted" weight="strong" caps style={styles.cell}>
                                {h}
                            </ThemedText>
                        ))}
                    </View>
                    <ScrollView style={styles.table} nestedScrollEnabled>
                        {record.holds.map((held, i) => {
                            const target = record.targets[i] ?? -1;
                            const short = target > 0 && held < target - 1000;
                            return (
                                <View key={i} style={styles.tableRow}>
                                    <ThemedText size="small" tabular style={styles.cell}>
                                        {i + 1}
                                    </ThemedText>
                                    <ThemedText size="small" color="muted" tabular style={styles.cell}>
                                        {target > 0 ? formatClock(target) : '—'}
                                    </ThemedText>
                                    <ThemedText
                                        size="small"
                                        weight="strong"
                                        tabular
                                        color={short ? 'warning' : 'text'}
                                        style={styles.cell}>
                                        {formatClock(held)}
                                    </ThemedText>
                                    <ThemedText size="small" color="muted" tabular style={styles.cell}>
                                        {record.contractions[i]?.length ? formatClock(record.contractions[i][0]) : '—'}
                                    </ThemedText>
                                </View>
                            );
                        })}
                    </ScrollView>
                </>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    wrap: {
        marginTop: spacing.md,
    },
    tableHead: {
        flexDirection: 'row',
        marginTop: spacing.md,
        paddingBottom: 6,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    table: {
        maxHeight: 220,
    },
    tableRow: {
        flexDirection: 'row',
        paddingVertical: 5,
    },
    cell: {
        flex: 1,
    },
});

export default RecordDetailDialog;
