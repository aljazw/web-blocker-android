import { Pressable, StyleSheet, View } from 'react-native';
import { Habit } from '../types/types';
import { useTheme } from '../context/ThemeContext';
import { shapes, spacing } from '../theme';
import { currentStreak, isDoneOn, recentDays } from '../utils/habits';
import { describeHabitDays } from '../utils/habitText';
import { ThemedText } from './ThemedText';
import { ThemedView } from './ThemedView';
import CheckButton from './CheckButton';
import Icon from './Icon';

interface HabitCardProps {
    habit: Habit;
    /** Whether the habit is due today; habits that aren't show no check button. */
    dueToday: boolean;
    onToggle: () => void;
    onOpen: () => void;
}

/** One habit: emoji, title, streak, last-7-days dots and (if due) the check button. */
const HabitCard: React.FC<HabitCardProps> = ({ habit, dueToday, onToggle, onOpen }) => {
    const { theme } = useTheme();
    const done = isDoneOn(habit, new Date());
    const streak = currentStreak(habit);

    return (
        <Pressable onPress={onOpen} accessibilityRole="button" accessibilityLabel={`Edit ${habit.title}`}>
            {({ pressed }) => (
                <ThemedView
                    withBorder
                    style={[
                        styles.card,
                        done && { borderColor: theme.colors.primaryGreen },
                        !dueToday && styles.notDue,
                        pressed && styles.pressed,
                    ]}>
                    <View style={[styles.emojiTile, { backgroundColor: theme.colors.elevated }]}>
                        <ThemedText style={styles.emoji}>{habit.emoji}</ThemedText>
                    </View>

                    <View style={styles.body}>
                        <ThemedText
                            weight="strong"
                            numberOfLines={1}
                            style={
                                done ? { color: theme.colors.muted, textDecorationLine: 'line-through' } : undefined
                            }>
                            {habit.title}
                        </ThemedText>
                        <View style={styles.metaRow}>
                            {streak > 0 && (
                                <View style={styles.streak}>
                                    <Icon name="Flame" size={13} tint="#FF8A3D" />
                                    <ThemedText size="small" weight="strong" style={styles.streakText}>
                                        {streak}
                                    </ThemedText>
                                </View>
                            )}
                            <ThemedText size="small" color="muted" numberOfLines={1}>
                                {describeHabitDays(habit.days)}
                                {habit.reminder ? ` · ${habit.reminder}` : ''}
                            </ThemedText>
                        </View>
                        <View style={styles.dots}>
                            {recentDays(habit).map(day => (
                                <View
                                    key={day.key}
                                    style={[
                                        styles.dot,
                                        day.done
                                            ? { backgroundColor: theme.colors.primaryGreen }
                                            : day.scheduled
                                            ? { backgroundColor: theme.colors.border }
                                            : styles.dotOff,
                                        day.isToday && { borderWidth: 1.5, borderColor: theme.colors.accent },
                                    ]}
                                />
                            ))}
                        </View>
                    </View>

                    {dueToday && (
                        <CheckButton
                            checked={done}
                            onPress={onToggle}
                            accessibilityLabel={done ? `Undo ${habit.title}` : `Complete ${habit.title}`}
                        />
                    )}
                </ThemedView>
            )}
        </Pressable>
    );
};

const styles = StyleSheet.create({
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        marginHorizontal: spacing.md,
        marginTop: spacing.sm,
        padding: spacing.md,
        borderRadius: shapes.borderRadius.large,
    },
    notDue: {
        opacity: 0.6,
    },
    pressed: {
        opacity: 0.85,
    },
    emojiTile: {
        width: 48,
        height: 48,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: spacing.md,
    },
    emoji: {
        fontSize: 24,
        lineHeight: 30,
    },
    body: {
        flex: 1,
        marginRight: spacing.sm,
    },
    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 2,
    },
    streak: {
        flexDirection: 'row',
        alignItems: 'center',
        marginRight: spacing.sm,
    },
    streakText: {
        color: '#FF8A3D',
        marginLeft: 2,
    },
    dots: {
        flexDirection: 'row',
        marginTop: spacing.sm,
    },
    dot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        marginRight: 5,
    },
    dotOff: {
        backgroundColor: 'transparent',
    },
});

export default HabitCard;
