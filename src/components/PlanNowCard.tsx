import { StyleSheet, View } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { spacing } from '../theme';
import { DaySchedule, PlanTask, formatDuration, formatMinutes } from '../utils/dayPlan';
import { ThemedText } from './ThemedText';
import Button from './Button';
import Card from './Card';
import IconTile from './IconTile';
import ProgressBar from './ProgressBar';

interface PlanNowCardProps {
    schedule: DaySchedule;
    /** Minutes after midnight. */
    now: number;
    onDone?: (task: PlanTask) => void | Promise<unknown>;
    onLater?: (task: PlanTask) => void | Promise<unknown>;
    onSkip?: (task: PlanTask) => void | Promise<unknown>;
    onPress?: () => void;
}

/** The one task to do right now, how long it has left, and what comes next. */
const PlanNowCard: React.FC<PlanNowCardProps> = ({ schedule, now, onDone, onLater, onSkip, onPress }) => {
    const { colors } = useTheme().theme;
    const { slots, current, anchors } = schedule;
    const counted = slots.filter(s => s.task.status !== 'skipped');
    if (slots.length === 0) {
        return null;
    }

    if (!current) {
        const done = counted.filter(s => s.task.status === 'done').length;
        return (
            <Card onPress={onPress} accessibilityLabel="Open day plan">
                <ThemedText size="tiny" weight="strong" caps color="primaryGreen">
                    Day complete
                </ThemedText>
                <View style={styles.head}>
                    <IconTile icon="Award" size={44} tone="success" />
                    <View style={styles.headText}>
                        <ThemedText size="large" weight="bold">
                            {done === counted.length ? 'You did everything you planned' : `${done} of ${counted.length} done`}
                        </ThemedText>
                        <ThemedText size="small" color="muted" tabular>
                            Free until bed at {formatMinutes(anchors.bed)}
                        </ThemedText>
                    </View>
                </View>
            </Card>
        );
    }

    const { task, start } = current;
    const notYet = now < start;
    const left = start + task.duration - now;
    const over = !notYet && left < 0;
    const next = slots.slice(slots.indexOf(current) + 1).find(s => s.task.status === 'open');

    return (
        <Card highlight={colors.accent} onPress={onPress} accessibilityLabel="Open day plan">
            <ThemedText size="tiny" weight="strong" color="accent" caps tabular>
                {notYet ? `Day starts at ${formatMinutes(start)}` : `Now · since ${formatMinutes(start)}`}
            </ThemedText>
            <View style={styles.head}>
                <IconTile icon={task.icon} size={44} tone="accent" />
                <View style={styles.headText}>
                    <ThemedText size="large" weight="bold" numberOfLines={2}>
                        {task.title}
                    </ThemedText>
                    <ThemedText size="small" color={over ? 'warning' : 'muted'} tabular>
                        {notYet
                            ? formatDuration(task.duration)
                            : over
                            ? `${formatDuration(-left)} over`
                            : `${formatDuration(left)} left`}
                    </ThemedText>
                </View>
            </View>
            {!notYet && (
                <ProgressBar
                    fraction={Math.min(1, (now - start) / task.duration)}
                    color={over ? colors.warning : colors.accent}
                    style={styles.bar}
                />
            )}
            {next && (
                <ThemedText size="small" color="muted" numberOfLines={1} style={styles.next} tabular>
                    Next · {next.task.title} around {formatMinutes(next.start)}
                </ThemedText>
            )}
            {onDone && (
                <View style={styles.actions}>
                    <Button label="Done" icon="Check" iconLeading compact onPress={() => onDone(task)} />
                    {onLater && next && (
                        <Button label="Later" variant="ghost" compact onPress={() => onLater(task)} />
                    )}
                    {onSkip && <Button label="Skip" variant="ghost" compact onPress={() => onSkip(task)} />}
                </View>
            )}
        </Card>
    );
};

const styles = StyleSheet.create({
    head: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: spacing.sm,
    },
    headText: {
        flex: 1,
        marginLeft: spacing.sm + 2,
    },
    bar: {
        marginTop: spacing.md,
    },
    next: {
        marginTop: spacing.sm,
    },
    actions: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: spacing.md,
        gap: spacing.xs,
    },
});

export default PlanNowCard;
