import { useEffect, useRef, useState } from 'react';
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
    /** If this returns a promise, the button shows a spinner and ignores taps until it settles. */
    onPress: () => void | Promise<unknown>;
    variant?: ButtonVariant;
    icon?: string;
    disabled?: boolean;
    loading?: boolean;
    compact?: boolean;
    style?: StyleProp<ViewStyle>;
}

/**
 * The app's one button: pill-shaped, themed, with optional trailing icon.
 * Taps are ignored while a previous async onPress is still running, so an
 * action (saving, deleting) can never run twice from a double tap.
 */
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
        if (running.current) return;
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
            if (mounted.current) setBusy(false);
        }
    };

    const inactive = disabled || loading || busy;

    return (
        <ScalePressable
            onPress={inactive ? undefined : handlePress}
            disabled={!!inactive}
            accessibilityRole="button"
            accessibilityState={{ disabled: !!inactive }}
            containerStyle={[inactive && styles.disabled, style]}
            style={[styles.base, compact && styles.compact, { backgroundColor: bg, borderColor }]}>
            {loading || busy ? (
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
