import { Pressable, StyleProp, StyleSheet, ViewStyle } from 'react-native';
import { gutter, shapes, spacing } from '../theme';
import { useTheme } from '../context/ThemeContext';
import { ThemedView } from './ThemedView';

interface CardProps {
    children: React.ReactNode;
    style?: StyleProp<ViewStyle>;
    /** Remove the inner padding (for lists that run edge to edge). */
    flush?: boolean;
    /** Highlight the border, e.g. for a selected or active card. */
    highlight?: string;
    onPress?: () => void;
    accessibilityLabel?: string;
}

/** The app's surface: a bordered panel with the page gutter. Pressable when given onPress. */
const Card: React.FC<CardProps> = ({ children, style, flush, highlight, onPress, accessibilityLabel }) => {
    const { theme } = useTheme();
    const body = (pressed: boolean) => (
        <ThemedView
            withBorder
            style={[
                styles.card,
                flush && styles.flush,
                highlight && { borderColor: highlight },
                pressed && { backgroundColor: theme.colors.elevated },
                style,
            ]}>
            {children}
        </ThemedView>
    );

    if (!onPress) {
        return body(false);
    }
    return (
        <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={accessibilityLabel}>
            {({ pressed }) => body(pressed)}
        </Pressable>
    );
};

const styles = StyleSheet.create({
    card: {
        marginHorizontal: gutter,
        marginTop: spacing.sm,
        padding: spacing.md,
        borderRadius: shapes.borderRadius.large,
    },
    flush: {
        padding: 0,
        overflow: 'hidden',
    },
});

export default Card;
