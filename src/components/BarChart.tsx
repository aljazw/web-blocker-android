import { StyleSheet, View } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { spacing } from '../theme';
import { ThemedText } from './ThemedText';

interface BarChartProps {
    values: number[];
    height?: number;
    /** Bar to emphasise (defaults to the highest). */
    highlightIndex?: number;
    /** Labels for the y-range, e.g. formatted min and max. */
    formatValue?: (value: number) => string;
}

/** Minimal bar chart for short trends, scaled between the series' min and max. */
const BarChart: React.FC<BarChartProps> = ({ values, height = 56, highlightIndex, formatValue }) => {
    const { colors } = useTheme().theme;
    if (values.length === 0) {
        return null;
    }

    const max = Math.max(...values);
    const min = Math.min(...values);
    // Start the scale below the minimum so small differences stay visible.
    const floor = min - (max - min) * 0.5 - 1;
    const best = highlightIndex ?? values.indexOf(max);

    return (
        <View style={styles.wrap}>
            <View style={[styles.bars, { height }]}>
                {values.map((value, i) => (
                    <View
                        key={i}
                        style={[
                            styles.bar,
                            {
                                height: Math.max(3, ((value - floor) / (max - floor)) * height),
                                backgroundColor: i === best ? colors.accent : colors.border,
                            },
                        ]}
                    />
                ))}
            </View>
            {formatValue && values.length > 1 && (
                <View style={styles.legend}>
                    <ThemedText size="tiny" color="muted" tabular>
                        {values.length} attempts
                    </ThemedText>
                    <ThemedText size="tiny" color="muted" tabular>
                        {formatValue(min)} – {formatValue(max)}
                    </ThemedText>
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    wrap: {
        marginTop: spacing.md,
    },
    bars: {
        flexDirection: 'row',
        alignItems: 'flex-end',
    },
    bar: {
        flex: 1,
        maxWidth: 18,
        marginRight: 4,
        borderRadius: 2,
    },
    legend: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 6,
    },
});

export default BarChart;
