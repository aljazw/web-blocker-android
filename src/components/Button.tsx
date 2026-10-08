import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { shapes, spacing } from '../theme';
import { useTheme } from '../context/ThemeContext';
import { ThemedText } from './ThemedText';
import Icon, { IconName } from './Icon';
import { ScalePressable } from './Motion';
import { haptics } from '../utils/haptics';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface ButtonProps {
    label: string;
    /** If this returns a promise, the button shows a spinner and ignores taps until it settles. */
    onPress: () => void | Promise<unknown>;
    variant?: ButtonVariant;
    icon?: IconName;
    /** Put the icon before the label instead of after it. */
    iconLeading?: boolean;
    disabled?: boolean;
    loading?: boolean;
    compact?: boolean;
    style?: StyleProp<ViewStyle>;
}

/**
 * The app's one button. Taps are ignored while a previous async onPress is
 * still running, so an action (saving, deleting) can never run twice from a
 * double tap.
 */
const Button: React.FC<ButtonProps> = ({
    label,
    onPress,
    variant = 'primary',
    icon,
    iconLeading,
    disabled,
    loading,
    compact,
    style,
}) => {
    const { colors } = useTheme().theme;
    const { bg, fg, borderColor } = {
        primary: { bg: colors.accent, fg: colors.onAccent, borderColor: colors.accent },
        secondary: { bg: colors.elevated, fg: colors.text, borderColor: colors.border },
        ghost: { bg: 'transparent', fg: colors.text, borderColor: 'transparent' },
        danger: { bg: colors.redSoft, fg: colors.primaryRed, borderColor: 'transparent' },
    }[variant];

    const [busy, setBusy] = useState(false);
    const running = useRef(false);
    const mounted = useRef(true);
    useEffect(
        () => () => {
            mounted.current = false;
        },
        [],
    );

    const handlePress = async () => {
        if (running.current) {
            return;
        }
        running.current = true;
        haptics.tap();
        try {
            const result = onPress();
            if (result instanceof Promise) {
                setBusy(true);
                await result;
            }
        } finally {
            running.current = false;
            if (mounted.current) {
                setBusy(false);
            }
        }
    };

    const inactive = disabled || loading || busy;
    const iconView = icon && (
        <Icon
            name={icon}
            size={compact ? 15 : 17}
            tint={fg}
            strokeWidth={2}
            style={iconLeading ? styles.iconLeading : styles.iconTrailing}
        />
    );

    return (
        <ScalePressable
            onPress={inactive ? undefined : handlePress}
            disabled={!!inactive}
            accessibilityRole="button"
            accessibilityLabel={label}
            accessibilityState={{ disabled: !!inactive }}
            containerStyle={[inactive && styles.disabled, style]}
            style={[styles.base, compact && styles.compact, { backgroundColor: bg, borderColor }]}>
            {loading || busy ? (
                <ActivityIndicator color={fg} />
            ) : (
                <View style={styles.row}>
                    {iconLeading && iconView}
                    <ThemedText weight="strong" size={compact ? 'small' : 'normal'} style={{ color: fg }}>
                        {label}
                    </ThemedText>
                    {!iconLeading && iconView}
                </View>
            )}
        </ScalePressable>
    );
};

const styles = StyleSheet.create({
    base: {
        minHeight: 48,
        paddingHorizontal: spacing.lg,
        borderRadius: shapes.borderRadius.medium,
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
    iconTrailing: {
        marginLeft: spacing.sm - 2,
    },
    iconLeading: {
        marginRight: spacing.sm - 2,
    },
    disabled: {
        opacity: 0.45,
    },
});

export default Button;
