import React, { useEffect, useRef, useState } from 'react';
import {
    Animated,
    Easing,
    LayoutAnimation,
    Pressable,
    PressableProps,
    StyleProp,
    StyleSheet,
    ViewStyle,
} from 'react-native';
import { ThemedText } from './ThemedText';

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
export const FadeIn: React.FC<FadeInProps> = ({ children, delay = 0, offset = 6, style }) => {
    const progress = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.timing(progress, {
            toValue: 1,
            duration: 260,
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
export const stagger = (index: number, step = 30, max = 8) => Math.min(index, max) * step;

interface ScalePressableProps extends Omit<PressableProps, 'style'> {
    style?: StyleProp<ViewStyle>;
    containerStyle?: StyleProp<ViewStyle>;
    scaleTo?: number;
    children: React.ReactNode;
}

/** Pressable that eases down slightly while held, for tactile feedback. */
export const ScalePressable: React.FC<ScalePressableProps> = ({
    style,
    containerStyle,
    scaleTo = 0.98,
    children,
    onPressIn,
    onPressOut,
    disabled,
    ...rest
}) => {
    const scale = useRef(new Animated.Value(1)).current;

    const springTo = (toValue: number) =>
        Animated.timing(scale, { toValue, duration: 90, useNativeDriver: true }).start();

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

/**
 * Shows `value`, counting to it when it changes. The first render shows the
 * value as is: counting up on every mount re-rendered whole screens for half
 * a second each time a tab opened.
 */
export const AnimatedNumber: React.FC<AnimatedNumberProps> = ({ value, duration = 450, ...textProps }) => {
    const [display, setDisplay] = useState(value);
    const shown = useRef(value);

    useEffect(() => {
        const from = shown.current;
        if (from === value) {
            return;
        }
        const anim = new Animated.Value(from);
        anim.addListener(({ value: v }) => {
            const next = Math.round(v);
            if (next !== shown.current) {
                shown.current = next;
                setDisplay(next);
            }
        });
        Animated.timing(anim, {
            toValue: value,
            duration,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: false,
        }).start(() => {
            shown.current = value;
            setDisplay(value);
        });
        return () => {
            anim.stopAnimation();
            anim.removeAllListeners();
        };
    }, [value, duration]);

    return <ThemedText {...textProps}>{display}</ThemedText>;
};

interface AnimatedBarProps {
    fraction: number;
    color: string;
    style?: StyleProp<ViewStyle>;
}

/** A progress fill that animates to `fraction` (0–1), scaled on the UI thread. */
export const AnimatedBar: React.FC<AnimatedBarProps> = ({ fraction, color, style }) => {
    const scale = useRef(new Animated.Value(fraction)).current;

    useEffect(() => {
        Animated.timing(scale, {
            toValue: fraction,
            duration: 450,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
        }).start();
    }, [scale, fraction]);

    return <Animated.View style={[style, styles.fill, { backgroundColor: color, transform: [{ scaleX: scale }] }]} />;
};

const styles = StyleSheet.create({
    fill: {
        width: '100%',
        transformOrigin: 'left',
    },
});
