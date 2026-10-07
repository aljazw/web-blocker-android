import { StyleProp, StyleSheet, ViewStyle } from 'react-native';
import { shapes, spacing } from '../theme';
import { useTheme } from '../context/ThemeContext';
import { ThemedText } from './ThemedText';
import { ScalePressable } from './Motion';
import { haptics } from '../utils/haptics';

interface ChipProps {
    label: string;
    selected?: boolean;
    disabled?: boolean;
    onPress?: () => void;
    style?: StyleProp<ViewStyle>;
}

/** Small rounded pill for tags, filters, presets and quick-add suggestions. */
const Chip: React.FC<ChipProps> = ({ label, selected, disabled, onPress, style }) => {
    const { theme } = useTheme();
    const { accent, accentSoft, elevated, border, text, muted } = theme.colors;

    return (
        <ScalePressable
            onPress={
                disabled || !onPress
                    ? undefined
                    : () => {
                          haptics.tap();
                          onPress();
                      }
            }
            disabled={!onPress || disabled}
            scaleTo={0.94}
            containerStyle={[styles.spacing, disabled && styles.disabled, style]}
            style={[
                styles.chip,
                {
                    backgroundColor: selected ? accentSoft : elevated,
                    borderColor: selected ? accent : border,
                },
            ]}>
            <ThemedText
                size="small"
                weight={selected ? 'strong' : 'medium'}
                style={{ color: selected ? accent : disabled ? muted : text }}>
                {label}
            </ThemedText>
        </ScalePressable>
    );
};

const styles = StyleSheet.create({
    chip: {
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: shapes.borderRadius.pill,
        borderWidth: shapes.borderWidth.thin,
    },
    spacing: {
        marginRight: spacing.sm,
        marginBottom: spacing.sm,
    },
    disabled: {
        opacity: 0.55,
    },
});

export default Chip;
