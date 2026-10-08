import React, { useMemo, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { ApneaRecord } from '../types/types';
import ApneaRecordRow from '../components/ApneaRecordRow';
import BackButton from '../components/BackButton';
import BaseScreen from '../components/BaseScreen';
import ErrorPopup from '../components/ErrorPopup';
import RecordDetailDialog from '../components/RecordDetailDialog';
import Segmented from '../components/Segmented';
import { ThemedText } from '../components/ThemedText';
import { useTheme } from '../context/ThemeContext';
import { useApneaData } from '../hooks/useApneaData';
import { gutter, shapes, spacing } from '../theme';
import { personalBest } from '../utils/apnea';
import { deleteApneaRecord } from '../utils/storage';
import { ERRORS } from '../constants/strings';

type Filter = 'all' | 'tables' | 'max' | 'breathing';

const FILTERS: { value: Filter; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'tables', label: 'Tables' },
    { value: 'max', label: 'Max holds' },
    { value: 'breathing', label: 'Breathing' },
];

const matches = (record: ApneaRecord, filter: Filter) =>
    filter === 'all' ||
    (filter === 'max' && record.kind === 'pb') ||
    (filter === 'breathing' && record.kind === 'breathing') ||
    (filter === 'tables' && record.kind !== 'pb' && record.kind !== 'breathing');

const ApneaHistoryScreen: React.FC = () => {
    const { colors } = useTheme().theme;
    const { records, loaded, reload } = useApneaData();
    const [filter, setFilter] = useState<Filter>('all');
    const [selected, setSelected] = useState<ApneaRecord | null>(null);
    const [error, setError] = useState(false);

    const bestId = useMemo(() => personalBest(records)?.record.id, [records]);
    const visible = useMemo(() => [...records].reverse().filter(r => matches(r, filter)), [records, filter]);

    const remove = async (record: ApneaRecord) => {
        setSelected(null);
        if (await deleteApneaRecord(record.id)) {
            reload();
        } else {
            setError(true);
        }
    };

    return (
        <BaseScreen
            title="History"
            subtitle={`${records.length} session${records.length === 1 ? '' : 's'}`}
            headerLeft={<BackButton />}
            isLoading={!loaded}>
            <Segmented options={FILTERS} value={filter} onChange={setFilter} style={styles.filter} />
            <FlatList
                data={visible}
                keyExtractor={r => r.id}
                contentContainerStyle={styles.list}
                initialNumToRender={20}
                renderItem={({ item, index }) => (
                    <View
                        style={[
                            styles.item,
                            { backgroundColor: colors.card, borderColor: colors.border },
                            index === 0 && styles.first,
                            index === visible.length - 1 && styles.last,
                            index > 0 && { borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth },
                        ]}>
                        <ApneaRecordRow record={item} isBest={item.id === bestId} onPress={() => setSelected(item)} />
                    </View>
                )}
                ListEmptyComponent={
                    <ThemedText color="muted" align="center" style={styles.empty}>
                        Nothing here yet.
                    </ThemedText>
                }
            />
            <RecordDetailDialog record={selected} onClose={() => setSelected(null)} onDelete={remove} />
            <ErrorPopup {...ERRORS.saveFailed} visible={error} onClose={() => setError(false)} />
        </BaseScreen>
    );
};

const styles = StyleSheet.create({
    filter: {
        marginHorizontal: gutter,
        marginBottom: spacing.sm,
    },
    list: {
        paddingHorizontal: gutter,
        paddingBottom: spacing.xl,
    },
    item: {
        borderLeftWidth: 1,
        borderRightWidth: 1,
        overflow: 'hidden',
    },
    first: {
        borderTopWidth: 1,
        borderTopLeftRadius: shapes.borderRadius.large,
        borderTopRightRadius: shapes.borderRadius.large,
    },
    last: {
        borderBottomWidth: 1,
        borderBottomLeftRadius: shapes.borderRadius.large,
        borderBottomRightRadius: shapes.borderRadius.large,
    },
    empty: {
        marginTop: spacing.xl,
    },
});

export default ApneaHistoryScreen;
