import { ActivityIndicator, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { shapes, spacing } from '../theme';
import { useTheme } from '../context/ThemeContext';
import { ThemedText } from './ThemedText';
import Icon from './Icon';
import { ScalePressable } from './Motion';
import { haptics } from '../utils/haptics';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface ButtonProps {
    label: string;
    onPress: () => void;
    variant?: ButtonVariant;
    icon?: string;
    disabled?: boolean;
    loading?: boolean;
    compact?: boolean;
    style?: StyleProp<ViewStyle>;
}

/** The app's one button: pill-shaped, themed, with optional trailing icon. */
const Button: React.FC<ButtonProps> = ({
    label,
    onPress,
    variant = 'primary',
    icon,
    disabled,
    loading,
    compact,
    style,
}) => {
    const { theme } = useTheme();
    const { accent, accentSoft, onAccent, primaryRed, text, border } = theme.colors;

    const palette: Record<ButtonVariant, { bg: string; fg: string; borderColor: string }> = {
        primary: { bg: accent, fg: onAccent, borderColor: accent },
        secondary: { bg: accentSoft, fg: accent, borderColor: 'transparent' },
        ghost: { bg: 'transparent', fg: text, borderColor: border },
        danger: { bg: primaryRed, fg: '#FFFFFF', borderColor: primaryRed },
    };
    const { bg, fg, borderColor } = palette[variant];
    const inactive = disabled || loading;

    return (
        <ScalePressable
            onPress={
                inactive
                    ? undefined
                    : () => {
                          haptics.tap();
                          onPress();
                      }
            }
            disabled={!!inactive}
            accessibilityRole="button"
            accessibilityState={{ disabled: !!inactive }}
            containerStyle={[inactive && styles.disabled, style]}
            style={[styles.base, compact && styles.compact, { backgroundColor: bg, borderColor }]}>
            {loading ? (
                <ActivityIndicator color={fg} />
            ) : (
                <View style={styles.row}>
                    <ThemedText weight="strong" size={compact ? 'small' : 'normal'} style={{ color: fg }}>
                        {label}
                    </ThemedText>
                    {icon && <Icon name={icon} size={compact ? 15 : 18} tint={fg} style={styles.icon} />}
                </View>
            )}
        </ScalePressable>
    );
};

const styles = StyleSheet.create({
    base: {
        flexGrow: 1,
        minHeight: 50,
        paddingHorizontal: spacing.lg,
        borderRadius: shapes.borderRadius.pill,
        borderWidth: shapes.borderWidth.thin,
        alignItems: 'center',
        justifyContent: 'center',
    },
    compact: {
        minHeight: 38,
        paddingHorizontal: spacing.md,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    icon: {
        marginLeft: spacing.sm,
    },
    disabled: {
        opacity: 0.5,
    },
});

export default Button;
