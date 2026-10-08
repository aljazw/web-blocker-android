import { StyleSheet, View } from 'react-native';
import { Habit } from '../types/types';
import { useTheme } from '../context/ThemeContext';
import { spacing } from '../theme';
import { currentStreak, isDoneOn, recentDays } from '../utils/habits';
import { describeHabitDays } from '../utils/habitText';
import { ThemedText } from './ThemedText';
import Card from './Card';
import CheckButton from './CheckButton';
import IconTile from './IconTile';

interface HabitCardProps {
    habit: Habit;
    /** Whether the habit is due today; habits that aren't show no check button. */
    dueToday: boolean;
    onToggle: () => void;
    onOpen: () => void;
}

/** One habit: icon, title, schedule, streak, last-7-days strip and (if due) the check box. */
const HabitCard: React.FC<HabitCardProps> = ({ habit, dueToday, onToggle, onOpen }) => {
    const { colors } = useTheme().theme;
    const done = isDoneOn(habit, new Date());
    const streak = currentStreak(habit);

    return (
        <Card
            onPress={onOpen}
            accessibilityLabel={`Edit ${habit.title}`}
            style={[styles.card, !dueToday && styles.notDue]}>
            <IconTile icon={habit.icon} size={40} tone={done ? 'success' : 'neutral'} />

            <View style={styles.body}>
                <ThemedText weight="medium" numberOfLines={1} color={done ? 'muted' : 'text'}>
                    {habit.title}
                </ThemedText>
                <ThemedText size="small" color="muted" numberOfLines={1} tabular>
                    {describeHabitDays(habit.days)}
                    {habit.reminder ? ` · ${habit.reminder}` : ''}
                    {streak > 0 ? ` · ${streak}-day streak` : ''}
                </ThemedText>
                <View style={styles.strip}>
                    {recentDays(habit).map(day => (
                        <View
                            key={day.key}
                            style={[
                                styles.day,
                                day.scheduled && { backgroundColor: colors.elevated },
                                day.done && { backgroundColor: colors.primaryGreen },
                                day.isToday && { borderColor: colors.muted },
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
        </Card>
    );
};

const styles = StyleSheet.create({
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: spacing.sm - 2,
        paddingVertical: spacing.sm + 4,
    },
    notDue: {
        opacity: 0.55,
    },
    body: {
        flex: 1,
        marginHorizontal: spacing.sm + 2,
    },
    strip: {
        flexDirection: 'row',
        marginTop: spacing.sm - 2,
    },
    day: {
        flex: 1,
        maxWidth: 22,
        height: 4,
        borderRadius: 2,
        marginRight: 3,
        borderWidth: 0.5,
        borderColor: 'transparent',
    },
});

export default HabitCard;
