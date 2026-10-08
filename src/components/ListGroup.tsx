import { Pressable, StyleProp, StyleSheet, Switch, View, ViewStyle } from 'react-native';
import { gutter, shapes, spacing } from '../theme';
import { useTheme } from '../context/ThemeContext';
import { ThemedText } from './ThemedText';
import { ThemedView } from './ThemedView';
import Icon, { IconName } from './Icon';
import IconTile from './IconTile';
import { haptics } from '../utils/haptics';

/** A bordered group of rows, separated by hairlines. Pass ListRows as children. */
export const ListGroup: React.FC<{ children: React.ReactNode; style?: StyleProp<ViewStyle> }> = ({
    children,
    style,
}) => {
    const { theme } = useTheme();
    const rows = (Array.isArray(children) ? children : [children]).flat().filter(Boolean);
    return (
        <ThemedView withBorder style={[styles.group, style]}>
            {rows.map((row, i) => (
                <View key={i}>
                    {i > 0 && <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />}
                    {row}
                </View>
            ))}
        </ThemedView>
    );
};

interface ListRowProps {
    icon?: IconName;
    title: string;
    description?: string;
    /** Description in red, for something that needs attention. */
    danger?: boolean;
    /** Makes the description a link. */
    onDescriptionPress?: () => void;
    onPress?: () => void;
    /** Shows a chevron when the row is pressable and has no other trailing content. */
    children?: React.ReactNode;
}

/** One settings-style row: icon, title, description, trailing control. */
export const ListRow: React.FC<ListRowProps> = ({
    icon,
    title,
    description,
    danger,
    onDescriptionPress,
    onPress,
    children,
}) => {
    const { theme } = useTheme();
    const trailing = children ?? (onPress ? <Icon name="Next" size={16} tint={theme.colors.muted} /> : null);

    const content = (
        <View style={styles.row}>
            {icon && <IconTile icon={icon} size={32} tone={danger ? 'danger' : 'neutral'} style={styles.icon} />}
            <View style={styles.text}>
                <ThemedText weight="medium">{title}</ThemedText>
                {description &&
                    (onDescriptionPress ? (
                        <Pressable onPress={onDescriptionPress} hitSlop={6}>
                            <ThemedText size="small" color="accent" weight="medium">
                                {description}
                            </ThemedText>
                        </Pressable>
                    ) : (
                        <ThemedText size="small" color={danger ? 'primaryRed' : 'muted'} style={styles.description}>
                            {description}
                        </ThemedText>
                    ))}
            </View>
            {trailing}
        </View>
    );

    return onPress ? (
        <Pressable
            onPress={onPress}
            accessibilityRole="button"
            style={({ pressed }) => pressed && { backgroundColor: theme.colors.elevated }}>
            {content}
        </Pressable>
    ) : (
        content
    );
};

/** A themed switch with haptic feedback. */
export const Toggle: React.FC<{ value: boolean; onValueChange: (v: boolean) => void; disabled?: boolean }> = ({
    value,
    onValueChange,
    disabled,
}) => {
    const { theme } = useTheme();
    return (
        <Switch
            value={value}
            disabled={disabled}
            onValueChange={v => {
                haptics.toggle();
                onValueChange(v);
            }}
            trackColor={{ false: theme.colors.border, true: theme.colors.accent }}
            thumbColor="#FFFFFF"
        />
    );
};

/** Label on the left, value on the right; for summaries and status lists. */
export const KeyValueRow: React.FC<{ label: string; value: string; valueColor?: string; dot?: string }> = ({
    label,
    value,
    valueColor,
    dot,
}) => (
    <View style={styles.kvRow}>
        <View style={styles.kvLabel}>
            {dot && <View style={[styles.dot, { backgroundColor: dot }]} />}
            <ThemedText size="small" color="muted">
                {label}
            </ThemedText>
        </View>
        <ThemedText size="small" weight="strong" tabular style={valueColor ? { color: valueColor } : undefined}>
            {value}
        </ThemedText>
    </View>
);

const styles = StyleSheet.create({
    group: {
        marginHorizontal: gutter,
        borderRadius: shapes.borderRadius.large,
        overflow: 'hidden',
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 13,
        paddingHorizontal: spacing.md,
        minHeight: 56,
    },
    icon: {
        marginRight: spacing.sm + 2,
    },
    text: {
        flex: 1,
        paddingRight: spacing.md,
    },
    description: {
        marginTop: 1,
    },
    divider: {
        height: StyleSheet.hairlineWidth,
        marginLeft: spacing.md,
    },
    kvRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 6,
    },
    kvLabel: {
        flexDirection: 'row',
        alignItems: 'center',
        flexShrink: 1,
        marginRight: spacing.sm,
    },
    dot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        marginRight: spacing.sm - 2,
    },
});
