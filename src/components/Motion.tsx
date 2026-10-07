import React, { useEffect, useRef, useState } from 'react';
import {
    Animated,
    Easing,
    LayoutAnimation,
    Platform,
    Pressable,
    PressableProps,
    StyleProp,
    UIManager,
    ViewStyle,
} from 'react-native';
import { ThemedText } from './ThemedText';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

/** Smoothly animate the next layout change (items appearing, removing, expanding). */
export const animateLayout = () =>
    LayoutAnimation.configureNext(LayoutAnimation.create(220, 'easeInEaseOut', 'opacity'));

interface FadeInProps {
    children: React.ReactNode;
    delay?: number;
    offset?: number;
    style?: StyleProp<ViewStyle>;
}

/** Fades and slides its children up into place on mount. */
export const FadeIn: React.FC<FadeInProps> = ({ children, delay = 0, offset = 14, style }) => {
    const progress = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.timing(progress, {
            toValue: 1,
            duration: 380,
            delay,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
        }).start();
    }, [progress, delay]);

    const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [offset, 0] });

    return (
        <Animated.View style={[style, { opacity: progress, transform: [{ translateY }] }]}>{children}</Animated.View>
    );
};

/** Stagger delay for the n-th item in a list, capped so long lists don't drag. */
export const stagger = (index: number, step = 45, max = 8) => Math.min(index, max) * step;

interface ScalePressableProps extends Omit<PressableProps, 'style'> {
    style?: StyleProp<ViewStyle>;
    containerStyle?: StyleProp<ViewStyle>;
    scaleTo?: number;
    children: React.ReactNode;
}

/** Pressable that springs down slightly while held — the "squishy" modern press feel. */
export const ScalePressable: React.FC<ScalePressableProps> = ({
    style,
    containerStyle,
    scaleTo = 0.96,
    children,
    onPressIn,
    onPressOut,
    disabled,
    ...rest
}) => {
    const scale = useRef(new Animated.Value(1)).current;

    const springTo = (toValue: number) =>
        Animated.spring(scale, { toValue, useNativeDriver: true, speed: 40, bounciness: 6 }).start();

    return (
        <Animated.View style={[containerStyle, { transform: [{ scale }] }]}>
            <Pressable
                {...rest}
                disabled={disabled}
                onPressIn={e => {
                    springTo(scaleTo);
                    onPressIn?.(e);
                }}
                onPressOut={e => {
                    springTo(1);
                    onPressOut?.(e);
                }}
                style={style}>
                {children}
            </Pressable>
        </Animated.View>
    );
};

type ThemedTextProps = React.ComponentProps<typeof ThemedText>;

interface AnimatedNumberProps extends Omit<ThemedTextProps, 'children'> {
    value: number;
    duration?: number;
}

/** Counts up (or down) to `value` whenever it changes. */
export const AnimatedNumber: React.FC<AnimatedNumberProps> = ({ value, duration = 650, ...textProps }) => {
    const anim = useRef(new Animated.Value(0)).current;
    const [display, setDisplay] = useState(0);

    useEffect(() => {
        const id = anim.addListener(({ value: v }) => setDisplay(Math.round(v)));
        Animated.timing(anim, {
            toValue: value,
            duration,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: false,
        }).start();
        return () => anim.removeListener(id);
    }, [anim, value, duration]);

    return <ThemedText {...textProps}>{display}</ThemedText>;
};

interface AnimatedBarProps {
    fraction: number;
    color: string;
    style?: StyleProp<ViewStyle>;
}

/** A progress fill that animates its width to `fraction` (0–1). */
export const AnimatedBar: React.FC<AnimatedBarProps> = ({ fraction, color, style }) => {
    const width = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.timing(width, {
            toValue: fraction,
            duration: 700,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: false,
        }).start();
    }, [width, fraction]);

    return (
        <Animated.View
            style={[
                style,
                {
                    backgroundColor: color,
                    width: width.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
                },
            ]}
        />
    );
};
