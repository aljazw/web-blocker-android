import { StyleSheet } from 'react-native';
import { shapes, spacing } from '../theme';
import { ThemedText } from './ThemedText';
import { ThemedView } from './ThemedView';
import { AnimatedNumber } from './Motion';

interface StatTileProps {
    label: string;
    value: number;
    /** Shown after the number, e.g. "%" or "d". */
    suffix?: string;
}

/** Small card with a big counting-up number and a label. Use inside a row. */
const StatTile: React.FC<StatTileProps> = ({ label, value, suffix }) => (
    <ThemedView withBorder style={styles.tile}>
        <ThemedText size="xlarge" weight="strong">
            <AnimatedNumber value={value} size="xlarge" weight="strong" />
            {suffix}
        </ThemedText>
        <ThemedText size="tiny" color="muted" weight="medium">
            {label}
        </ThemedText>
    </ThemedView>
);

const styles = StyleSheet.create({
    tile: {
        flex: 1,
        marginHorizontal: 4,
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.md,
        borderRadius: shapes.borderRadius.medium,
    },
});

export default StatTile;
