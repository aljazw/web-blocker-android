import { Pressable, StyleSheet, View } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { gutter, shapes, spacing } from '../theme';
import { DaySchedule, Slot, formatDuration, formatMinutes } from '../utils/dayPlan';
import { ThemedText } from './ThemedText';
import CheckButton from './CheckButton';
import Icon, { IconName } from './Icon';
import IconTile from './IconTile';
import { FadeIn, stagger } from './Motion';

interface PlanTimelineProps {
    schedule: DaySchedule;
    onOpen: (slot: Slot) => void;
    /** Omitted when tasks can't be checked off (a future day). */
    onToggle?: (slot: Slot) => void;
    /** Tapping wake-up or bedtime. */
    onAnchor?: () => void;
}

/** The day from wake-up to bedtime: each task with its estimated time, in order. */
const PlanTimeline: React.FC<PlanTimelineProps> = ({ schedule, onOpen, onToggle, onAnchor }) => {
    const { slots, anchors } = schedule;
    return (
        <View style={styles.list}>
            <AnchorRow icon="Sunrise" label="Wake up" time={anchors.wake} onPress={onAnchor} />
            {slots.map((slot, i) => (
                <FadeIn key={slot.task.id} delay={stagger(i, 20)}>
                    <TaskRow
                        slot={slot}
                        onOpen={() => onOpen(slot)}
                        onToggle={onToggle && slot.task.status !== 'skipped' ? () => onToggle(slot) : undefined}
                    />
                </FadeIn>
            ))}
            <AnchorRow icon="Moon" label="Bedtime" time={anchors.bed} onPress={onAnchor} last />
        </View>
    );
};

const TaskRow: React.FC<{ slot: Slot; onOpen: () => void; onToggle?: () => void }> = ({ slot, onOpen, onToggle }) => {
    const { colors } = useTheme().theme;
    const { task, current, fits } = slot;
    const done = task.status === 'done';
    const skipped = task.status === 'skipped';
    const late = !done && !skipped && !fits;

    const time = done
        ? task.finishedAt !== undefined
            ? formatMinutes(task.finishedAt)
            : ''
        : skipped
        ? '–'
        : formatMinutes(slot.start);
    const meta = [
        done ? 'Done' : skipped ? 'Skipped' : formatDuration(task.duration),
        current ? 'Now' : null,
        late ? 'Won’t fit' : null,
        task.habit ? null : 'Only this day',
    ].filter(Boolean);
    const dot = done ? colors.primaryGreen : current ? colors.accent : late ? colors.warning : colors.border;

    return (
        <View style={styles.row}>
            <View style={styles.times}>
                <ThemedText
                    size="small"
                    weight={current ? 'strong' : 'regular'}
                    tabular
                    color={current ? 'accent' : done || skipped ? 'muted' : 'text'}>
                    {time}
                </ThemedText>
            </View>
            <Rail color={dot} filled={done || current} />
            <Pressable
                onPress={onOpen}
                accessibilityRole="button"
                accessibilityLabel={`${task.title}, ${meta.join(', ')}`}
                style={({ pressed }) => [
                    styles.body,
                    {
                        backgroundColor: pressed ? colors.elevated : colors.card,
                        borderColor: current ? colors.accent : colors.border,
                    },
                    skipped && styles.faded,
                ]}>
                <IconTile icon={task.icon} size={34} tone={done ? 'success' : current ? 'accent' : 'neutral'} />
                <View style={styles.text}>
                    <ThemedText
                        weight="medium"
                        numberOfLines={1}
                        color={done || skipped ? 'muted' : 'text'}
                        style={(done || skipped) && styles.struck}>
                        {task.title}
                    </ThemedText>
                    <ThemedText size="small" numberOfLines={1} color={late ? 'warning' : current ? 'accent' : 'muted'}>
                        {meta.join(' · ')}
                    </ThemedText>
                </View>
                {onToggle && (
                    <CheckButton
                        checked={done}
                        onPress={onToggle}
                        size={30}
                        accessibilityLabel={done ? `Undo ${task.title}` : `Complete ${task.title}`}
                    />
                )}
            </Pressable>
        </View>
    );
};

const AnchorRow: React.FC<{ icon: IconName; label: string; time: number; last?: boolean; onPress?: () => void }> = ({
    icon,
    label,
    time,
    last,
    onPress,
}) => {
    const { colors } = useTheme().theme;
    return (
        <View style={styles.row}>
            <View style={styles.times}>
                <ThemedText size="small" weight="strong" tabular>
                    {formatMinutes(time)}
                </ThemedText>
            </View>
            <Rail color={colors.muted} filled hideLine={last} />
            <Pressable
                onPress={onPress}
                disabled={!onPress}
                accessibilityRole="button"
                accessibilityLabel={`${label} ${formatMinutes(time)}. Change sleep time`}
                style={styles.anchor}>
                <Icon name={icon} size={16} tint={colors.muted} />
                <ThemedText size="small" color="muted" style={styles.anchorLabel}>
                    {label}
                </ThemedText>
            </Pressable>
        </View>
    );
};

const Rail: React.FC<{ color: string; filled: boolean; hideLine?: boolean }> = ({ color, filled, hideLine }) => {
    const { colors } = useTheme().theme;
    return (
        <View style={styles.rail}>
            <View style={[styles.dot, { borderColor: color, backgroundColor: filled ? color : colors.background }]} />
            {!hideLine && <View style={[styles.line, { backgroundColor: colors.border }]} />}
        </View>
    );
};

const RAIL = 22;

const styles = StyleSheet.create({
    list: {
        marginHorizontal: gutter,
        marginTop: spacing.xs,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'stretch',
    },
    times: {
        width: 46,
        paddingTop: spacing.sm + 2,
    },
    rail: {
        width: RAIL,
        alignItems: 'center',
    },
    dot: {
        width: 11,
        height: 11,
        borderRadius: 6,
        borderWidth: 2,
        marginTop: spacing.sm + 6,
    },
    line: {
        flex: 1,
        width: StyleSheet.hairlineWidth * 2,
        marginTop: 2,
        minHeight: 8,
    },
    body: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        padding: spacing.sm,
        paddingRight: spacing.sm + 2,
        marginBottom: spacing.sm - 2,
        borderWidth: shapes.borderWidth.thin,
        borderRadius: shapes.borderRadius.large,
    },
    faded: {
        opacity: 0.6,
    },
    text: {
        flex: 1,
        marginHorizontal: spacing.sm,
    },
    struck: {
        textDecorationLine: 'line-through',
    },
    anchor: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        paddingTop: spacing.sm + 2,
        paddingBottom: spacing.md,
        paddingHorizontal: spacing.xs,
    },
    anchorLabel: {
        marginLeft: spacing.xs + 2,
    },
});

export default PlanTimeline;
