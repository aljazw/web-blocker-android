import { StyleSheet, View } from 'react-native';
import { Habit, PlanBlock } from '../types/types';
import { useTheme } from '../context/ThemeContext';
import { spacing } from '../theme';
import { blockTimes, formatDuration, formatMinutes, isBlockDone, motivationFor, planMoment } from '../utils/dayPlan';
import { ThemedText } from './ThemedText';
import Card from './Card';
import CheckButton from './CheckButton';
import IconTile from './IconTile';
import ProgressBar from './ProgressBar';

interface PlanNowCardProps {
    /** Today's visible blocks. */
    blocks: PlanBlock[];
    habits: Habit[];
    dateKey: string;
    /** Minutes after midnight. */
    now: number;
    onToggle?: (block: PlanBlock) => void;
    onPress?: () => void;
}

/** What you should be doing right now, how long is left, and what comes next. */
const PlanNowCard: React.FC<PlanNowCardProps> = ({ blocks, habits, dateKey, now, onToggle, onPress }) => {
    const { colors } = useTheme().theme;
    const moment = planMoment(blocks, now);
    if (moment.kind === 'empty') {
        return null;
    }

    const doneCount = blocks.filter(b => isBlockDone(b, habits, dateKey)).length;
    const progress = (
        <View style={styles.dayRow}>
            <ProgressBar
                fraction={doneCount / blocks.length}
                color={doneCount === blocks.length ? colors.primaryGreen : colors.accent}
                style={styles.dayBar}
            />
            <ThemedText size="small" color="muted" tabular>
                {doneCount}/{blocks.length} done
            </ThemedText>
        </View>
    );

    const nextLine = (next: PlanBlock | null) =>
        next ? (
            <ThemedText size="small" color="muted" numberOfLines={1} style={styles.next} tabular>
                Next · {formatMinutes(next.start)} {next.title}
            </ThemedText>
        ) : null;

    if (moment.kind === 'during') {
        const { block, next } = moment;
        const done = isBlockDone(block, habits, dateKey);
        const length = block.end - block.start;
        return (
            <Card highlight={done ? undefined : colors.accent} onPress={onPress} accessibilityLabel="Open day plan">
                <ThemedText size="tiny" weight="strong" color="accent" caps tabular>
                    Now · {blockTimes(block)}
                </ThemedText>
                <View style={styles.head}>
                    <IconTile icon={block.icon} size={44} tone={done ? 'success' : 'accent'} />
                    <View style={styles.headText}>
                        <ThemedText size="large" weight="bold" numberOfLines={1}>
                            {block.title}
                        </ThemedText>
                        <ThemedText size="small" color="muted" numberOfLines={2}>
                            {done
                                ? 'Done. Well executed.'
                                : `${formatDuration(block.end - now)} left · ${motivationFor(dateKey + block.id)}`}
                        </ThemedText>
                    </View>
                    {onToggle && (
                        <CheckButton
                            checked={done}
                            onPress={() => onToggle(block)}
                            accessibilityLabel={done ? `Undo ${block.title}` : `Complete ${block.title}`}
                        />
                    )}
                </View>
                <ProgressBar fraction={(now - block.start) / length} style={styles.blockBar} />
                {nextLine(next)}
                {progress}
            </Card>
        );
    }

    const eyebrow =
        moment.kind === 'before'
            ? `Day starts in ${formatDuration(moment.next.start - now)}`
            : moment.kind === 'free'
            ? `Free time · until ${formatMinutes(moment.until)}`
            : doneCount === blocks.length
            ? 'Day complete'
            : 'Day over';
    const title =
        moment.kind === 'after'
            ? doneCount === blocks.length
                ? 'You followed your plan today'
                : `${doneCount} of ${blocks.length} blocks done`
            : `${moment.next.title} at ${formatMinutes(moment.next.start)}`;

    return (
        <Card onPress={onPress} accessibilityLabel="Open day plan">
            <ThemedText
                size="tiny"
                weight="strong"
                caps
                tabular
                color={moment.kind === 'after' && doneCount === blocks.length ? 'primaryGreen' : 'muted'}>
                {eyebrow}
            </ThemedText>
            <View style={styles.head}>
                <IconTile
                    icon={moment.kind === 'after' ? 'Award' : moment.next.icon}
                    size={44}
                    tone={moment.kind === 'after' && doneCount === blocks.length ? 'success' : 'neutral'}
                />
                <View style={styles.headText}>
                    <ThemedText size="large" weight="bold" numberOfLines={2}>
                        {title}
                    </ThemedText>
                    {moment.kind === 'after' && (
                        <ThemedText size="small" color="muted">
                            Look over tomorrow and adjust what needs to change.
                        </ThemedText>
                    )}
                </View>
            </View>
            {progress}
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
        marginHorizontal: spacing.sm + 2,
    },
    blockBar: {
        marginTop: spacing.md,
    },
    next: {
        marginTop: spacing.sm,
    },
    dayRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: spacing.md,
    },
    dayBar: {
        flex: 1,
        marginRight: spacing.sm,
    },
});

export default PlanNowCard;
