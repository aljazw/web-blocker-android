import { StyleSheet, View } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { spacing } from '../theme';
import { DayScore } from '../utils/dayPlan';
import Card from './Card';
import { ThemedText } from './ThemedText';

const BAR_HEIGHT = 44;

/** How much of the plan got done on each of the last days. */
const PlanHistory: React.FC<{ days: DayScore[] }> = ({ days }) => {
    const { colors } = useTheme().theme;
    const planned = days.filter(d => d.total > 0);
    if (planned.length < 2) {
        return null;
    }
    const total = planned.reduce((sum, d) => sum + d.total, 0);
    const done = planned.reduce((sum, d) => sum + d.done, 0);

    return (
        <Card>
            <View style={styles.head}>
                <ThemedText size="tiny" weight="strong" color="muted" caps>
                    Followed
                </ThemedText>
                <ThemedText size="small" color="muted" tabular>
                    {Math.round((done / total) * 100)}% of planned blocks
                </ThemedText>
            </View>
            <View style={styles.row}>
                {days.map((day, i) => {
                    const share = day.total ? day.done / day.total : 0;
                    const today = i === days.length - 1;
                    return (
                        <View key={day.date} style={styles.day} accessibilityLabel={`${day.done} of ${day.total} done`}>
                            <View style={[styles.track, { backgroundColor: colors.elevated }]}>
                                <View
                                    style={[
                                        styles.fill,
                                        {
                                            height: Math.max(day.total ? 3 : 0, share * BAR_HEIGHT),
                                            backgroundColor: share === 1 ? colors.primaryGreen : colors.accent,
                                        },
                                    ]}
                                />
                            </View>
                            <ThemedText
                                size="tiny"
                                color={today ? 'text' : 'muted'}
                                weight={today ? 'strong' : 'regular'}>
                                {day.label}
                            </ThemedText>
                        </View>
                    );
                })}
            </View>
        </Card>
    );
};

const styles = StyleSheet.create({
    head: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'baseline',
    },
    row: {
        flexDirection: 'row',
        marginTop: spacing.md,
    },
    day: {
        flex: 1,
        alignItems: 'center',
    },
    track: {
        width: 14,
        height: BAR_HEIGHT,
        borderRadius: 4,
        justifyContent: 'flex-end',
        overflow: 'hidden',
        marginBottom: spacing.xs,
    },
    fill: {
        width: '100%',
    },
});

export default PlanHistory;
