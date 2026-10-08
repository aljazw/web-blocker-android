import { Pressable, StyleProp, StyleSheet, ViewStyle } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { shapes } from '../theme';
import Icon, { IconName } from './Icon';

interface IconButtonProps {
    icon: IconName;
    onPress: () => void;
    accessibilityLabel: string;
    /** filled = accent background (primary header action); outline = bordered; plain = no chrome. */
    variant?: 'plain' | 'outline' | 'filled';
    size?: number;
    tint?: string;
    style?: StyleProp<ViewStyle>;
}

/** Square icon-only button for headers and list rows. */
const IconButton: React.FC<IconButtonProps> = ({
    icon,
    onPress,
    accessibilityLabel,
    variant = 'plain',
    size = 40,
    tint,
    style,
}) => {
    const { colors } = useTheme().theme;
    const chrome = {
        plain: { backgroundColor: 'transparent', borderColor: 'transparent' },
        outline: { backgroundColor: colors.card, borderColor: colors.border },
        filled: { backgroundColor: colors.accent, borderColor: colors.accent },
    }[variant];
    const color = tint ?? (variant === 'filled' ? colors.onAccent : variant === 'plain' ? colors.muted : colors.text);

    return (
        <Pressable
            onPress={onPress}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={accessibilityLabel}
            style={({ pressed }) => [
                styles.button,
                chrome,
                { width: size, height: size },
                pressed && {
                    opacity: 0.7,
                    backgroundColor: variant === 'plain' ? colors.elevated : chrome.backgroundColor,
                },
                style,
            ]}>
            <Icon name={icon} size={Math.round(size * 0.45)} tint={color} strokeWidth={2} />
        </Pressable>
    );
};

const styles = StyleSheet.create({
    button: {
        borderRadius: shapes.borderRadius.medium,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
});

export default IconButton;
