import { Pressable, StyleSheet, View } from 'react-native';
import { ApneaKind, ApneaRecord } from '../types/types';
import { useTheme } from '../context/ThemeContext';
import { spacing } from '../theme';
import { recordSummary } from '../utils/apnea';
import { shortDate } from '../utils/dates';
import { ThemedText } from './ThemedText';
import IconTile from './IconTile';
import Badge from './Badge';
import { IconName } from './Icon';

export const KIND_ICON: Record<ApneaKind, IconName> = {
    co2: 'Timer',
    o2: 'Hourglass',
    custom: 'Sliders',
    pb: 'Trophy',
    breathing: 'Wind',
};

interface ApneaRecordRowProps {
    record: ApneaRecord;
    /** Marks the row holding the current personal best. */
    isBest?: boolean;
    onPress: () => void;
}

/** One history entry, for use inside a ListGroup. */
const ApneaRecordRow: React.FC<ApneaRecordRowProps> = ({ record, isBest, onPress }) => {
    const { colors } = useTheme().theme;
    const date = new Date(record.startedAt);
    return (
        <Pressable
            onPress={onPress}
            accessibilityRole="button"
            style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.elevated }]}>
            <IconTile icon={KIND_ICON[record.kind]} size={32} tone={isBest ? 'accent' : 'neutral'} />
            <View style={styles.text}>
                <ThemedText weight="medium" numberOfLines={1}>
                    {record.title}
                </ThemedText>
                <ThemedText size="small" color="muted" numberOfLines={1}>
                    {recordSummary(record)}
                </ThemedText>
            </View>
            <View style={styles.trailing}>
                {isBest ? (
                    <Badge label="PB" tone="accent" />
                ) : !record.completed && record.kind !== 'pb' ? (
                    <Badge label="Ended early" />
                ) : null}
                <ThemedText size="tiny" color="muted" tabular style={styles.date}>
                    {shortDate(date)} · {date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                </ThemedText>
            </View>
        </Pressable>
    );
};

const styles = StyleSheet.create({
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: spacing.md,
    },
    text: {
        flex: 1,
        marginHorizontal: spacing.sm + 2,
    },
    trailing: {
        alignItems: 'flex-end',
    },
    date: {
        marginTop: 4,
    },
});

export default ApneaRecordRow;
