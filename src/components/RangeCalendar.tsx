import { memo, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import IconButton from './IconButton';
import { ThemedText } from './ThemedText';
import { useTheme } from '../context/ThemeContext';
import { spacing } from '../theme';
import { addDays, fromDateKey, startOfWeek, toDateKey } from '../utils/dates';

interface RangeCalendarProps {
    /** Selected first and last day ("YYYY-MM-DD"); end is null while only the start is picked. */
    start: string | null;
    end: string | null;
    onChange: (start: string | null, end: string | null) => void;
    /** Days before this key can't be picked. */
    minDate: string;
}

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
const CELL = 40;

/** First day of the month containing `key`, as a Date at local noon. */
const monthOf = (key: string) => {
    const d = fromDateKey(key);
    return new Date(d.getFullYear(), d.getMonth(), 1, 12);
};

/**
 * Month calendar for picking a date range: the first tap sets the start, the
 * second the end (tapping an earlier day moves the start instead).
 */
const RangeCalendar: React.FC<RangeCalendarProps> = ({ start, end, onChange, minDate }) => {
    const { colors } = useTheme().theme;
    const [month, setMonth] = useState(() => monthOf(start ?? minDate));

    const weeks = useMemo(() => {
        const first = startOfWeek(month);
        first.setHours(12);
        return Array.from({ length: 6 }, (_week, w) =>
            Array.from({ length: 7 }, (_day, d) => addDays(first, w * 7 + d)),
        ).filter(week => week.some(day => day.getMonth() === month.getMonth()));
    }, [month]);

    const canGoBack = month > monthOf(minDate);
    const shiftMonth = (by: number) => setMonth(new Date(month.getFullYear(), month.getMonth() + by, 1, 12));

    const pick = (key: string) => {
        if (!start || end || key < start) {
            onChange(key, null);
        } else {
            onChange(start, key);
        }
    };

    return (
        <View>
            <View style={styles.header}>
                <IconButton
                    icon="Back"
                    accessibilityLabel="Previous month"
                    onPress={() => canGoBack && shiftMonth(-1)}
                    tint={canGoBack ? colors.text : colors.border}
                    size={36}
                />
                <ThemedText weight="strong" style={styles.title}>
                    {month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
                </ThemedText>
                <IconButton
                    icon="Next"
                    accessibilityLabel="Next month"
                    onPress={() => shiftMonth(1)}
                    tint={colors.text}
                    size={36}
                />
            </View>

            <View style={styles.row}>
                {WEEKDAYS.map(day => (
                    <View key={day} style={styles.cell}>
                        <ThemedText size="tiny" color="muted" weight="medium">
                            {day}
                        </ThemedText>
                    </View>
                ))}
            </View>

            {weeks.map(week => (
                <View key={toDateKey(week[0])} style={styles.row}>
                    {week.map(day => {
                        const key = toDateKey(day);
                        return (
                            <DayCell
                                key={key}
                                label={day.getDate()}
                                dateKey={key}
                                inMonth={day.getMonth() === month.getMonth()}
                                disabled={key < minDate}
                                isEdge={key === start || key === end}
                                inRange={!!start && !!end && key > start && key < end}
                                bandLeft={!!start && !!end && start !== end && key > start && key <= end}
                                bandRight={!!start && !!end && start !== end && key >= start && key < end}
                                onPick={pick}
                            />
                        );
                    })}
                </View>
            ))}
        </View>
    );
};

interface DayCellProps {
    label: number;
    dateKey: string;
    inMonth: boolean;
    disabled: boolean;
    /** The first or last selected day. */
    isEdge: boolean;
    inRange: boolean;
    /** Draw the range band towards the previous / next day. */
    bandLeft: boolean;
    bandRight: boolean;
    onPick: (key: string) => void;
}

const DayCell = memo(function DayCell({
    label,
    dateKey,
    inMonth,
    disabled,
    isEdge,
    inRange,
    bandLeft,
    bandRight,
    onPick,
}: DayCellProps) {
    const { colors } = useTheme().theme;
    const textColor = isEdge ? colors.onAccent : disabled || !inMonth ? colors.border : colors.text;

    return (
        <Pressable
            disabled={disabled}
            onPress={() => onPick(dateKey)}
            accessibilityRole="button"
            accessibilityState={{ selected: isEdge || inRange, disabled }}
            accessibilityLabel={fromDateKey(dateKey).toLocaleDateString(undefined, {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
            })}
            style={styles.cell}>
            {bandLeft && <View style={[styles.band, styles.bandLeft, { backgroundColor: colors.accentSoft }]} />}
            {bandRight && <View style={[styles.band, styles.bandRight, { backgroundColor: colors.accentSoft }]} />}
            <View style={[styles.day, isEdge && { backgroundColor: colors.accent }]}>
                <ThemedText
                    size="small"
                    weight={isEdge || inRange ? 'strong' : 'regular'}
                    tabular
                    style={{ color: textColor }}>
                    {label}
                </ThemedText>
            </View>
        </Pressable>
    );
});

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: spacing.sm,
    },
    title: {
        flex: 1,
        textAlign: 'center',
    },
    row: {
        flexDirection: 'row',
    },
    cell: {
        flex: 1,
        height: CELL,
        alignItems: 'center',
        justifyContent: 'center',
    },
    band: {
        position: 'absolute',
        top: 4,
        bottom: 4,
    },
    bandLeft: {
        left: 0,
        right: '50%',
    },
    bandRight: {
        left: '50%',
        right: 0,
    },
    day: {
        width: CELL - 8,
        height: CELL - 8,
        borderRadius: (CELL - 8) / 2,
        alignItems: 'center',
        justifyContent: 'center',
    },
});

export default RangeCalendar;
