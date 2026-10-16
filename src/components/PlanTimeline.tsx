import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Animated, PanResponder, Pressable, StyleSheet, View } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { haptics } from '../utils/haptics';
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
    /** Saves a new task order (hold a task, then drag it). Omitted = no reordering. */
    onReorder?: (ids: string[]) => Promise<boolean>;
    /** A drag started or ended; the screen stops scrolling meanwhile so the drag gets the touch. */
    onDragChange?: (dragging: boolean) => void;
}

interface Drag {
    id: string;
    from: number;
    /** Where it would land, as an index in the list without it. */
    target: number;
}

/** `ids` with `id` moved to `target` (an index in the list without it). */
const moved = (ids: string[], id: string, target: number): string[] => {
    const rest = ids.filter(x => x !== id);
    rest.splice(target, 0, id);
    return rest;
};

/** The day from wake-up to bedtime: each task with its estimated time, in order. */
const PlanTimeline: React.FC<PlanTimelineProps> = ({
    schedule,
    onOpen,
    onToggle,
    onAnchor,
    onReorder,
    onDragChange,
}) => {
    const { slots, anchors } = schedule;
    const ids = useMemo(() => slots.map(s => s.task.id), [slots]);
    const orderKey = ids.join('|');

    // Row positions as laid out (before any drag offsets), by task id.
    const layouts = useRef(new Map<string, { y: number; h: number }>()).current;
    // How far each row is nudged to make room for the dragged one.
    const shifts = useRef(new Map<string, Animated.Value>()).current;
    const shiftOf = (id: string) => {
        let value = shifts.get(id);
        if (!value) {
            value = new Animated.Value(0);
            shifts.set(id, value);
        }
        return value;
    };
    const dragY = useRef(new Animated.Value(0)).current;
    const drag = useRef<Drag | null>(null);
    const [dragId, setDragId] = useState<string | null>(null);
    const latest = useRef({ ids, onReorder, onDragChange });
    latest.current = { ids, onReorder, onDragChange };

    const reset = () => {
        dragY.stopAnimation();
        dragY.setValue(0);
        shifts.forEach(v => {
            v.stopAnimation();
            v.setValue(0);
        });
        drag.current = null;
        setDragId(null);
    };
    // The new order is on screen: drop the offsets in the same frame, so nothing jumps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useLayoutEffect(reset, [orderKey]);

    const height = (id: string) => layouts.get(id)?.h ?? 0;

    const start = (id: string) => {
        const from = latest.current.ids.indexOf(id);
        if (from < 0 || !layouts.has(id)) {
            return;
        }
        haptics.tap();
        drag.current = { id, from, target: from };
        dragY.setValue(0);
        setDragId(id);
        latest.current.onDragChange?.(true);
    };

    const move = (dy: number) => {
        const d = drag.current;
        const me = d && layouts.get(d.id);
        if (!d || !me) {
            return;
        }
        dragY.setValue(dy);
        const center = me.y + me.h / 2 + dy;
        const others = latest.current.ids.filter(x => x !== d.id);
        const target = others.filter(x => {
            const l = layouts.get(x);
            return !!l && l.y + l.h / 2 < center;
        }).length;
        if (target === d.target) {
            return;
        }
        d.target = target;
        haptics.tap();
        latest.current.ids.forEach((x, i) => {
            if (x === d.id) {
                return;
            }
            // Rows the dragged one has passed slide over to fill its old place.
            const toValue = i < d.from && i >= target ? me.h : i > d.from && i - 1 < target ? -me.h : 0;
            Animated.timing(shiftOf(x), { toValue, duration: 140, useNativeDriver: false }).start();
        });
    };

    const end = async () => {
        const d = drag.current;
        if (!d) {
            return;
        }
        // Release and touch-end can both report the same drop; handle it once.
        drag.current = null;
        latest.current.onDragChange?.(false);
        const { ids: current, onReorder: save } = latest.current;
        if (d.target === d.from || !save) {
            Animated.timing(dragY, { toValue: 0, duration: 140, useNativeDriver: false }).start(reset);
            return;
        }
        // Settle into the gap it opened, then save; the reset above clears the offsets.
        const passed = d.target > d.from ? current.slice(d.from + 1, d.target + 1) : current.slice(d.target, d.from);
        const offset = passed.reduce((sum, x) => sum + height(x), 0) * (d.target > d.from ? 1 : -1);
        Animated.timing(dragY, { toValue: offset, duration: 120, useNativeDriver: false }).start();
        if (await save(moved(current, d.id, d.target))) {
            haptics.toggle();
        } else {
            reset();
        }
    };

    /** One step up or down, for screen readers. */
    const step = (id: string, by: number) => {
        const from = ids.indexOf(id);
        const to = from + by;
        if (to >= 0 && to < ids.length) {
            onReorder?.(moved(ids, id, to));
        }
    };

    return (
        <View style={styles.list}>
            <AnchorRow icon="Sunrise" label="Wake up" time={anchors.wake} onPress={onAnchor} />
            {slots.map((slot, i) => {
                const id = slot.task.id;
                const lifted = dragId === id;
                return (
                    <DragRow
                        key={id}
                        offset={lifted ? dragY : shiftOf(id)}
                        lifted={lifted}
                        onLayout={(y, h) => layouts.set(id, { y, h })}
                        onMove={move}
                        onEnd={end}>
                        {arm => (
                            <FadeIn delay={stagger(i, 20)}>
                                <TaskRow
                                    slot={slot}
                                    lifted={lifted}
                                    onOpen={() => onOpen(slot)}
                                    onToggle={
                                        onToggle && slot.task.status !== 'skipped' ? () => onToggle(slot) : undefined
                                    }
                                    // Done tasks keep their place: they happened when they happened.
                                    drag={
                                        onReorder && slot.task.status !== 'done'
                                            ? {
                                                  onLift: () => arm(() => start(id)),
                                                  onUp: () => step(id, -1),
                                                  onDown: () => step(id, 1),
                                              }
                                            : undefined
                                    }
                                />
                            </FadeIn>
                        )}
                    </DragRow>
                );
            })}
            <AnchorRow icon="Moon" label="Bedtime" time={anchors.bed} onPress={onAnchor} last />
        </View>
    );
};

interface DragRowProps {
    offset: Animated.Value;
    lifted: boolean;
    onLayout: (y: number, height: number) => void;
    onMove: (dy: number) => void;
    onEnd: () => void;
    /** Gets `arm`: call it on long press with the start of the drag. */
    children: (arm: (start: () => void) => void) => React.ReactNode;
}

/**
 * A row that can be picked up. A long press arms it; the next move takes
 * the touch over from the row's button and drags the row along.
 */
const DragRow: React.FC<DragRowProps> = ({ offset, lifted, onLayout, onMove, onEnd, children }) => {
    const armed = useRef(false);
    const handlers = useRef({ onMove, onEnd });
    handlers.current = { onMove, onEnd };

    const responder = useMemo(
        () =>
            PanResponder.create({
                onMoveShouldSetPanResponderCapture: () => armed.current,
                onPanResponderTerminationRequest: () => false,
                onPanResponderMove: (_, g) => handlers.current.onMove(g.dy),
                onPanResponderRelease: () => {
                    armed.current = false;
                    handlers.current.onEnd();
                },
                onPanResponderTerminate: () => {
                    armed.current = false;
                    handlers.current.onEnd();
                },
            }),
        [],
    );

    const arm = (begin: () => void) => {
        armed.current = true;
        begin();
    };

    return (
        <Animated.View
            {...responder.panHandlers}
            // Let go after a long press without moving: put it back down.
            onTouchEnd={() => {
                if (armed.current) {
                    armed.current = false;
                    handlers.current.onEnd();
                }
            }}
            onLayout={e => onLayout(e.nativeEvent.layout.y, e.nativeEvent.layout.height)}
            style={[lifted && styles.lifted, { transform: [{ translateY: offset }] }]}>
            {children(arm)}
        </Animated.View>
    );
};

interface TaskRowProps {
    slot: Slot;
    lifted: boolean;
    onOpen: () => void;
    onToggle?: () => void;
    drag?: { onLift: () => void; onUp: () => void; onDown: () => void };
}

const TaskRow: React.FC<TaskRowProps> = ({ slot, lifted, onOpen, onToggle, drag }) => {
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
                onLongPress={drag?.onLift}
                delayLongPress={300}
                accessibilityRole="button"
                accessibilityLabel={`${task.title}, ${meta.join(', ')}`}
                accessibilityHint={drag ? 'Hold and drag to change the order' : undefined}
                accessibilityActions={
                    drag
                        ? [
                              { name: 'moveUp', label: 'Move earlier' },
                              { name: 'moveDown', label: 'Move later' },
                          ]
                        : undefined
                }
                onAccessibilityAction={e => (e.nativeEvent.actionName === 'moveUp' ? drag?.onUp() : drag?.onDown())}
                style={({ pressed }) => [
                    styles.body,
                    {
                        backgroundColor: pressed || lifted ? colors.elevated : colors.card,
                        borderColor: current || lifted ? colors.accent : colors.border,
                    },
                    lifted && styles.liftedBody,
                    skipped && !lifted && styles.faded,
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
    lifted: {
        zIndex: 10,
        elevation: 10,
    },
    liftedBody: {
        elevation: 6,
        shadowColor: '#000',
        shadowOpacity: 0.2,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 3 },
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
