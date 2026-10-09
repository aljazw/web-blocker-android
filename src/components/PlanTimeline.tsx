import { Pressable, StyleSheet, View } from 'react-native';
import { Habit, PlanBlock } from '../types/types';
import { useTheme } from '../context/ThemeContext';
import { gutter, shapes, spacing } from '../theme';
import { Gap, formatDuration, formatMinutes, gapsBetween, isBlockDone, overlapping } from '../utils/dayPlan';
import { ThemedText } from './ThemedText';
import CheckButton from './CheckButton';
import Icon from './Icon';
import IconTile from './IconTile';
import { FadeIn, stagger } from './Motion';

interface PlanTimelineProps {
    /** The day's visible blocks, in time order. */
    blocks: PlanBlock[];
    habits: Habit[];
    dateKey: string;
    /** Minutes after midnight when the plan is today's; null for another day. */
    now: number | null;
    onOpen: (block: PlanBlock) => void;
    /** Omitted when blocks can't be checked off (a future day). */
    onToggle?: (block: PlanBlock) => void;
    onAddInGap: (gap: Gap) => void;
}

type Status = 'done' | 'now' | 'missed' | 'upcoming';

/** The day as a vertical timeline: time, rail, block, and the free time between blocks. */
const PlanTimeline: React.FC<PlanTimelineProps> = ({ blocks, habits, dateKey, now, onOpen, onToggle, onAddInGap }) => {
    const gaps = gapsBetween(blocks);
    const clashes = overlapping(blocks);
    const rows: ({ kind: 'block'; block: PlanBlock } | { kind: 'gap'; gap: Gap })[] = [];
    for (const block of blocks) {
        const gap = gaps.find(g => g.end === block.start);
        if (gap && !rows.some(r => r.kind === 'gap' && r.gap === gap)) {
            rows.push({ kind: 'gap', gap });
        }
        rows.push({ kind: 'block', block });
    }

    const statusOf = (block: PlanBlock): Status => {
        if (isBlockDone(block, habits, dateKey)) {
            return 'done';
        }
        if (now === null || now < block.start) {
            return 'upcoming';
        }
        return now < block.end ? 'now' : 'missed';
    };

    return (
        <View style={styles.list}>
            {rows.map((row, i) =>
                row.kind === 'gap' ? (
                    <GapRow key={`gap-${row.gap.start}`} gap={row.gap} onPress={() => onAddInGap(row.gap)} />
                ) : (
                    <FadeIn key={row.block.id} delay={stagger(i, 20)}>
                        <BlockRow
                            block={row.block}
                            status={statusOf(row.block)}
                            clash={clashes.has(row.block.id)}
                            linked={!!row.block.habitId}
                            last={i === rows.length - 1}
                            onOpen={() => onOpen(row.block)}
                            onToggle={onToggle ? () => onToggle(row.block) : undefined}
                        />
                    </FadeIn>
                ),
            )}
        </View>
    );
};

interface BlockRowProps {
    block: PlanBlock;
    status: Status;
    clash: boolean;
    linked: boolean;
    last: boolean;
    onOpen: () => void;
    onToggle?: () => void;
}

const BlockRow: React.FC<BlockRowProps> = ({ block, status, clash, linked, last, onOpen, onToggle }) => {
    const { colors } = useTheme().theme;
    const dot = {
        done: colors.primaryGreen,
        now: colors.accent,
        missed: colors.warning,
        upcoming: colors.border,
    }[status];

    const meta = [
        formatDuration(block.end - block.start),
        status === 'now' ? 'Now' : status === 'missed' ? 'Not done' : null,
        linked ? 'Habit' : null,
        block.once ? 'Today only' : null,
        clash ? 'Overlaps' : null,
    ].filter(Boolean);

    return (
        <View style={styles.row}>
            <View style={styles.times}>
                <ThemedText size="small" weight="strong" tabular color={status === 'now' ? 'accent' : 'text'}>
                    {formatMinutes(block.start)}
                </ThemedText>
                <ThemedText size="tiny" color="muted" tabular>
                    {formatMinutes(block.end)}
                </ThemedText>
            </View>

            <View style={styles.rail}>
                <View
                    style={[
                        styles.dot,
                        { borderColor: dot, backgroundColor: status === 'upcoming' ? colors.background : dot },
                    ]}
                />
                {!last && <View style={[styles.line, { backgroundColor: colors.border }]} />}
            </View>

            <Pressable
                onPress={onOpen}
                accessibilityRole="button"
                accessibilityLabel={`Edit ${block.title}, ${formatMinutes(block.start)} to ${formatMinutes(block.end)}`}
                style={({ pressed }) => [
                    styles.body,
                    {
                        backgroundColor: pressed ? colors.elevated : colors.card,
                        borderColor: status === 'now' ? colors.accent : colors.border,
                    },
                ]}>
                <IconTile
                    icon={block.icon}
                    size={34}
                    tone={status === 'done' ? 'success' : status === 'now' ? 'accent' : 'neutral'}
                />
                <View style={styles.text}>
                    <ThemedText
                        weight="medium"
                        numberOfLines={1}
                        color={status === 'done' ? 'muted' : 'text'}
                        style={status === 'done' && styles.struck}>
                        {block.title}
                    </ThemedText>
                    <ThemedText
                        size="small"
                        numberOfLines={1}
                        color={clash || status === 'missed' ? 'warning' : status === 'now' ? 'accent' : 'muted'}>
                        {meta.join(' · ')}
                    </ThemedText>
                </View>
                {onToggle && (
                    <CheckButton
                        checked={status === 'done'}
                        onPress={onToggle}
                        size={30}
                        accessibilityLabel={status === 'done' ? `Undo ${block.title}` : `Complete ${block.title}`}
                    />
                )}
            </Pressable>
        </View>
    );
};

const GapRow: React.FC<{ gap: Gap; onPress: () => void }> = ({ gap, onPress }) => {
    const { colors } = useTheme().theme;
    return (
        <View style={styles.row}>
            <View style={styles.times} />
            <View style={styles.rail}>
                <View style={[styles.line, { backgroundColor: colors.border }]} />
            </View>
            <Pressable
                onPress={onPress}
                accessibilityRole="button"
                accessibilityLabel={`Add a block in the free time from ${formatMinutes(gap.start)}`}
                style={({ pressed }) => [
                    styles.gap,
                    { borderColor: colors.border },
                    pressed && { backgroundColor: colors.elevated },
                ]}>
                <ThemedText size="small" color="muted" tabular style={styles.text}>
                    Free · {formatDuration(gap.end - gap.start)}
                </ThemedText>
                <Icon name="Plus" size={15} tint={colors.accent} strokeWidth={2.2} />
                <ThemedText size="small" weight="medium" color="accent" style={styles.gapAdd}>
                    Add
                </ThemedText>
            </Pressable>
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
    text: {
        flex: 1,
        marginHorizontal: spacing.sm,
    },
    struck: {
        textDecorationLine: 'line-through',
    },
    gap: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 7,
        paddingRight: spacing.sm + 2,
        marginBottom: spacing.sm - 2,
        borderWidth: shapes.borderWidth.thin,
        borderStyle: 'dashed',
        borderRadius: shapes.borderRadius.large,
    },
    gapAdd: {
        marginLeft: 4,
    },
});

export default PlanTimeline;
