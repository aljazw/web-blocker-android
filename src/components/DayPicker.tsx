import { Pressable, StyleSheet, View } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { shapes } from '../theme';
import { ThemedText } from './ThemedText';
import { WEEK_DAYS } from '../utils/schedule';
import { haptics } from '../utils/haptics';

interface DayPickerProps {
    /** Seven flags, Monday first. */
    value: boolean[];
    onChange: (days: boolean[]) => void;
}

/** Row of seven day toggles (M T W T F S S). */
const DayPicker: React.FC<DayPickerProps> = ({ value, onChange }) => {
    const { theme } = useTheme();

    const toggle = (index: number) => {
        haptics.tap();
        onChange(value.map((on, i) => (i === index ? !on : on)));
    };

    return (
        <View style={styles.row}>
            {WEEK_DAYS.map((day, index) => {
                const on = value[index];
                return (
                    <Pressable
                        key={day}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: on }}
                        accessibilityLabel={day}
                        onPress={() => toggle(index)}
                        style={[styles.pill, { backgroundColor: on ? theme.colors.accent : theme.colors.elevated }]}>
                        <ThemedText
                            size="small"
                            weight="medium"
                            style={{ color: on ? theme.colors.onAccent : theme.colors.muted }}>
                            {day.charAt(0)}
                        </ThemedText>
                    </Pressable>
                );
            })}
        </View>
    );
};

const styles = StyleSheet.create({
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    pill: {
        width: 38,
        height: 38,
        borderRadius: shapes.borderRadius.medium,
        alignItems: 'center',
        justifyContent: 'center',
    },
});

export default DayPicker;
