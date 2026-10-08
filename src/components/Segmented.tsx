import { Pressable, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { shapes } from '../theme';
import { useTheme } from '../context/ThemeContext';
import { ThemedText } from './ThemedText';
import { animateLayout } from './Motion';
import { haptics } from '../utils/haptics';

interface SegmentedProps<T extends string> {
    options: { value: T; label: string }[];
    value: T;
    onChange: (value: T) => void;
    style?: StyleProp<ViewStyle>;
}

/** iOS-style segmented control: a pill track with the selected option raised. */
function Segmented<T extends string>({ options, value, onChange, style }: SegmentedProps<T>) {
    const { theme } = useTheme();

    return (
        <View style={[styles.track, { backgroundColor: theme.colors.elevated }, style]}>
            {options.map(option => {
                const active = option.value === value;
                return (
                    <Pressable
                        key={option.value}
                        onPress={() => {
                            if (active) return;
                            haptics.tap();
                            animateLayout();
                            onChange(option.value);
                        }}
                        style={[styles.item, active && { backgroundColor: theme.colors.card }]}>
                        <ThemedText
                            size="small"
                            weight="strong"
                            style={{ color: active ? theme.colors.text : theme.colors.muted }}>
                            {option.label}
                        </ThemedText>
                    </Pressable>
                );
            })}
        </View>
    );
}

const styles = StyleSheet.create({
    track: {
        flexDirection: 'row',
        borderRadius: shapes.borderRadius.pill,
        padding: 4,
    },
    item: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 9,
        borderRadius: shapes.borderRadius.pill,
    },
});

export default Segmented;
