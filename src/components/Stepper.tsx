import { Pressable, StyleSheet, View } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { shapes } from '../theme';
import { ThemedText } from './ThemedText';
import Icon from './Icon';
import { haptics } from '../utils/haptics';

interface StepperProps {
    value: number;
    onChange: (value: number) => void;
    min: number;
    max: number;
    step?: number;
    /** How the value is shown, e.g. seconds as "1:30". */
    format?: (value: number) => string;
    accessibilityLabel: string;
    compact?: boolean;
}

/** − value + control for small numeric adjustments. */
const Stepper: React.FC<StepperProps> = ({
    value,
    onChange,
    min,
    max,
    step = 1,
    format = String,
    accessibilityLabel,
    compact,
}) => {
    const { colors } = useTheme().theme;
    const change = (delta: number) => {
        const next = Math.min(max, Math.max(min, value + delta));
        if (next !== value) {
            haptics.tap();
            onChange(next);
        }
    };
    const size = compact ? 30 : 36;

    const button = (delta: number) => {
        const disabled = delta < 0 ? value <= min : value >= max;
        return (
            <Pressable
                onPress={() => change(delta)}
                disabled={disabled}
                hitSlop={6}
                accessibilityRole="button"
                accessibilityLabel={`${delta < 0 ? 'Decrease' : 'Increase'} ${accessibilityLabel}`}
                style={({ pressed }) => [
                    styles.button,
                    { width: size, height: size, borderColor: colors.border },
                    pressed && { backgroundColor: colors.elevated },
                    disabled && styles.disabled,
                ]}>
                <Icon name={delta < 0 ? 'Minus' : 'Plus'} size={compact ? 14 : 16} tint={colors.text} strokeWidth={2} />
            </Pressable>
        );
    };

    return (
        <View style={styles.row} accessibilityLabel={`${accessibilityLabel}: ${format(value)}`}>
            {button(-step)}
            <ThemedText
                weight="strong"
                tabular
                align="center"
                size={compact ? 'small' : 'normal'}
                style={compact ? styles.valueCompact : styles.value}>
                {format(value)}
            </ThemedText>
            {button(step)}
        </View>
    );
};

const styles = StyleSheet.create({
    row: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    button: {
        borderWidth: 1,
        borderRadius: shapes.borderRadius.small + 2,
        alignItems: 'center',
        justifyContent: 'center',
    },
    disabled: {
        opacity: 0.35,
    },
    value: {
        minWidth: 52,
    },
    valueCompact: {
        minWidth: 44,
    },
});

export default Stepper;
