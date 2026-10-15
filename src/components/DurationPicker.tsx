import { useEffect, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { shapes, spacing } from '../theme';
import { ThemedText } from './ThemedText';
import Icon from './Icon';
import { haptics } from '../utils/haptics';

interface DurationPickerProps {
    /** Minutes. */
    value: number;
    onChange: (minutes: number) => void;
    min: number;
    max: number;
    /** One-tap lengths shown under the value. */
    presets: number[];
    accessibilityLabel: string;
}

/** Fine steps for short tasks, coarser ones as they get longer. */
const stepAt = (minutes: number) => (minutes < 60 ? 5 : minutes < 180 ? 15 : 30);

const stepUp = (value: number) => {
    const step = stepAt(value);
    return Math.floor(value / step) * step + step;
};

const stepDown = (value: number) => {
    const step = stepAt(value - 1);
    return Math.ceil(value / step) * step - step;
};

const HOLD_DELAY = 350;
const HOLD_INTERVAL = 110;

/** Big "1 h 30" readout with −/+ (hold to repeat) and a row of one-tap presets. */
const DurationPicker: React.FC<DurationPickerProps> = ({ value, onChange, min, max, presets, accessibilityLabel }) => {
    const { colors } = useTheme().theme;
    const latest = useRef(value);
    latest.current = value;
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const held = useRef(false);

    const stop = () => {
        if (timer.current) {
            clearTimeout(timer.current);
            timer.current = null;
        }
    };
    useEffect(() => stop, []);

    const nudge = (up: boolean) => {
        const current = latest.current;
        const next = Math.min(max, Math.max(min, up ? stepUp(current) : stepDown(current)));
        if (next === current) {
            stop();
            return;
        }
        haptics.tap();
        latest.current = next;
        onChange(next);
    };

    const startHold = (up: boolean) => {
        held.current = false;
        const repeat = () => {
            held.current = true;
            nudge(up);
            timer.current = setTimeout(repeat, HOLD_INTERVAL);
        };
        timer.current = setTimeout(repeat, HOLD_DELAY);
    };

    const hours = Math.floor(value / 60);
    const minutes = value % 60;

    const button = (up: boolean) => {
        const disabled = up ? value >= max : value <= min;
        return (
            <Pressable
                onPress={() => !held.current && nudge(up)}
                onPressIn={() => startHold(up)}
                onPressOut={stop}
                disabled={disabled}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={`${up ? 'Increase' : 'Decrease'} ${accessibilityLabel}`}
                style={({ pressed }) => [
                    styles.button,
                    { borderColor: colors.border, backgroundColor: pressed ? colors.elevated : colors.card },
                    disabled && styles.disabled,
                ]}>
                <Icon name={up ? 'Plus' : 'Minus'} size={20} tint={colors.text} strokeWidth={2} />
            </Pressable>
        );
    };

    const unit = (text: string) => (
        <ThemedText size="large" weight="medium" color="muted" style={styles.unit}>
            {text}
        </ThemedText>
    );

    return (
        <View>
            <View style={styles.row}>
                {button(false)}
                <View
                    style={styles.readout}
                    accessible
                    accessibilityRole="adjustable"
                    accessibilityLabel={accessibilityLabel}
                    accessibilityValue={{ text: `${hours ? `${hours} hours ` : ''}${minutes} minutes` }}
                    accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
                    onAccessibilityAction={e => nudge(e.nativeEvent.actionName === 'increment')}>
                    {hours > 0 && (
                        <View style={styles.part}>
                            <ThemedText size="display" weight="strong" tabular>
                                {hours}
                            </ThemedText>
                            {unit('h')}
                        </View>
                    )}
                    {(minutes > 0 || hours === 0) && (
                        <View style={styles.part}>
                            <ThemedText size="display" weight="strong" tabular>
                                {minutes}
                            </ThemedText>
                            {unit('min')}
                        </View>
                    )}
                </View>
                {button(true)}
            </View>

            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.presets}
                keyboardShouldPersistTaps="handled">
                {presets.map(preset => {
                    const selected = preset === value;
                    return (
                        <Pressable
                            key={preset}
                            onPress={() => {
                                haptics.tap();
                                onChange(preset);
                            }}
                            accessibilityRole="button"
                            accessibilityState={{ selected }}
                            style={[
                                styles.preset,
                                {
                                    backgroundColor: selected ? colors.accentSoft : colors.elevated,
                                    borderColor: selected ? colors.accent : colors.elevated,
                                },
                            ]}>
                            <ThemedText size="small" weight="medium" tabular color={selected ? 'accent' : 'text'}>
                                {preset < 60
                                    ? `${preset}m`
                                    : preset % 60
                                    ? `${Math.floor(preset / 60)}h ${preset % 60}m`
                                    : `${preset / 60}h`}
                            </ThemedText>
                        </Pressable>
                    );
                })}
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    button: {
        width: 48,
        height: 48,
        borderRadius: shapes.borderRadius.pill,
        borderWidth: shapes.borderWidth.thin,
        alignItems: 'center',
        justifyContent: 'center',
    },
    disabled: {
        opacity: 0.35,
    },
    readout: {
        flex: 1,
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 10,
    },
    part: {
        flexDirection: 'row',
        alignItems: 'baseline',
    },
    unit: {
        marginLeft: 3,
    },
    presets: {
        paddingTop: spacing.md,
        gap: spacing.xs + 2,
    },
    preset: {
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: shapes.borderRadius.pill,
        borderWidth: shapes.borderWidth.thin,
    },
});

export default DurationPicker;
