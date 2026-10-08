import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { shapes } from '../theme';
import { useTheme } from '../context/ThemeContext';
import { ThemedText } from './ThemedText';

export type BadgeTone = 'neutral' | 'accent' | 'success' | 'danger' | 'warning';

interface BadgeProps {
    label: string;
    tone?: BadgeTone;
    /** Leading status dot. */
    dot?: boolean;
    style?: StyleProp<ViewStyle>;
}

/** Compact status label, e.g. "ACTIVE" or "PB". */
const Badge: React.FC<BadgeProps> = ({ label, tone = 'neutral', dot, style }) => {
    const { colors } = useTheme().theme;
    const { bg, fg } = {
        neutral: { bg: colors.elevated, fg: colors.muted },
        accent: { bg: colors.accentSoft, fg: colors.accent },
        success: { bg: colors.greenSoft, fg: colors.primaryGreen },
        danger: { bg: colors.redSoft, fg: colors.primaryRed },
        warning: { bg: colors.elevated, fg: colors.warning },
    }[tone];

    return (
        <View style={[styles.badge, { backgroundColor: bg }, style]}>
            {dot && <View style={[styles.dot, { backgroundColor: fg }]} />}
            <ThemedText size="tiny" weight="strong" caps style={{ color: fg }}>
                {label}
            </ThemedText>
        </View>
    );
};

const styles = StyleSheet.create({
    badge: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: shapes.borderRadius.small,
    },
    dot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        marginRight: 6,
    },
});

export default Badge;
