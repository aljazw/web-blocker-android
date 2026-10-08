import { StyleProp, StyleSheet, ViewStyle } from 'react-native';
import { shapes, spacing } from '../theme';
import { useTheme } from '../context/ThemeContext';
import { ThemedText } from './ThemedText';
import Icon, { IconName } from './Icon';
import { ScalePressable } from './Motion';
import { haptics } from '../utils/haptics';

interface ChipProps {
    label: string;
    icon?: IconName;
    selected?: boolean;
    disabled?: boolean;
    onPress?: () => void;
    style?: StyleProp<ViewStyle>;
}

/** Compact selectable tag for filters, presets and quick-add suggestions. */
const Chip: React.FC<ChipProps> = ({ label, icon, selected, disabled, onPress, style }) => {
    const { accent, accentSoft, card, border, text, muted } = useTheme().theme.colors;
    const fg = selected ? accent : disabled ? muted : text;

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
            accessibilityRole="button"
            accessibilityState={{ selected: !!selected, disabled: !!disabled }}
            containerStyle={[styles.spacing, disabled && styles.disabled, style]}
            style={[
                styles.chip,
                { backgroundColor: selected ? accentSoft : card, borderColor: selected ? accent : border },
            ]}>
            {icon && <Icon name={icon} size={14} tint={fg} strokeWidth={2} style={styles.icon} />}
            <ThemedText size="small" weight="medium" style={{ color: fg }}>
                {label}
            </ThemedText>
        </ScalePressable>
    );
};

const styles = StyleSheet.create({
    chip: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: shapes.borderRadius.medium,
        borderWidth: shapes.borderWidth.thin,
    },
    icon: {
        marginRight: 6,
    },
    spacing: {
        marginRight: spacing.sm - 2,
        marginBottom: spacing.sm - 2,
    },
    disabled: {
        opacity: 0.5,
    },
});

export default Chip;
