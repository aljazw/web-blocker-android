import { StyleSheet } from 'react-native';
import { shapes, spacing } from '../theme';
import { ThemedText } from './ThemedText';
import { ThemedView } from './ThemedView';
import { AnimatedNumber } from './Motion';

interface StatTileProps {
    label: string;
    /** A number counts up; a string (e.g. "2:45") is shown as is. */
    value: number | string;
    /** Shown after a number, e.g. "%" or "d". */
    suffix?: string;
}

/** Metric card: small caps label over a large tabular value. Use inside a row. */
const StatTile: React.FC<StatTileProps> = ({ label, value, suffix }) => (
    <ThemedView withBorder style={styles.tile}>
        <ThemedText size="tiny" color="muted" weight="strong" caps numberOfLines={1}>
            {label}
        </ThemedText>
        <ThemedText size="xlarge" weight="bold" tabular style={styles.value} numberOfLines={1}>
            {typeof value === 'number' ? <AnimatedNumber value={value} size="xlarge" weight="bold" tabular /> : value}
            {suffix ? (
                <ThemedText size="small" color="muted" weight="medium">
                    {suffix}
                </ThemedText>
            ) : null}
        </ThemedText>
    </ThemedView>
);

const styles = StyleSheet.create({
    tile: {
        flex: 1,
        marginHorizontal: 4,
        paddingVertical: spacing.sm + 2,
        paddingHorizontal: spacing.sm + 2,
        borderRadius: shapes.borderRadius.large,
    },
    value: {
        marginTop: 6,
    },
});

export default StatTile;
