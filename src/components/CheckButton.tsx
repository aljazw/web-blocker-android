import { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import Icon from './Icon';

interface CheckButtonProps {
    checked: boolean;
    onPress: () => void;
    size?: number;
    accessibilityLabel?: string;
}

/** Round check-off button. Checking it pops the circle and sends out a ring "burst". */
const CheckButton: React.FC<CheckButtonProps> = ({ checked, onPress, size = 46, accessibilityLabel }) => {
    const { theme } = useTheme();
    const scale = useRef(new Animated.Value(1)).current;
    const burst = useRef(new Animated.Value(0)).current;
    const wasChecked = useRef(checked);

    useEffect(() => {
        // Animate only on a real false -> true change, not on first render.
        if (checked && !wasChecked.current) {
            scale.setValue(0.7);
            burst.setValue(0);
            Animated.parallel([
                Animated.spring(scale, { toValue: 1, friction: 4, tension: 160, useNativeDriver: true }),
                Animated.timing(burst, {
                    toValue: 1,
                    duration: 520,
                    easing: Easing.out(Easing.cubic),
                    useNativeDriver: true,
                }),
            ]).start();
        }
        wasChecked.current = checked;
    }, [checked, scale, burst]);

    const ringScale = burst.interpolate({ inputRange: [0, 1], outputRange: [1, 1.9] });
    const ringOpacity = burst.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 0.6, 0] });

    return (
        <Pressable
            onPress={onPress}
            hitSlop={8}
            accessibilityRole="checkbox"
            accessibilityState={{ checked }}
            accessibilityLabel={accessibilityLabel}>
            <View style={{ width: size, height: size }}>
                <Animated.View
                    pointerEvents="none"
                    style={[
                        StyleSheet.absoluteFill,
                        styles.round,
                        {
                            borderRadius: size / 2,
                            borderColor: theme.colors.primaryGreen,
                            opacity: ringOpacity,
                            transform: [{ scale: ringScale }],
                        },
                    ]}
                />
                <Animated.View
                    style={[
                        styles.circle,
                        {
                            width: size,
                            height: size,
                            borderRadius: size / 2,
                            backgroundColor: checked ? theme.colors.primaryGreen : 'transparent',
                            borderColor: checked ? theme.colors.primaryGreen : theme.colors.muted,
                            transform: [{ scale }],
                        },
                    ]}>
                    {checked && <Icon name="Check" size={size * 0.5} strokeWidth={3} tint="#FFFFFF" />}
                </Animated.View>
            </View>
        </Pressable>
    );
};

const styles = StyleSheet.create({
    round: {
        borderWidth: 3,
    },
    circle: {
        borderWidth: 2.5,
        alignItems: 'center',
        justifyContent: 'center',
    },
});

export default CheckButton;
