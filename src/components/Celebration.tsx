import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import BlurModal from './BlurModal';
import Button from './Button';
import { ThemedText } from './ThemedText';
import { spacing } from '../theme';

const PARTICLES = ['🎉', '✨', '🔥', '⭐', '💪', '🎊', '✨', '🌟', '🎉', '⭐', '🔥', '✨'];

interface CelebrationProps {
    visible: boolean;
    emoji: string;
    title: string;
    message: string;
    onClose: () => void;
}

/** Big friendly "you did it" moment: bouncing emoji plus a confetti burst. */
const Celebration: React.FC<CelebrationProps> = ({ visible, emoji, title, message, onClose }) => {
    const pop = useRef(new Animated.Value(0)).current;
    const burst = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (!visible) return;
        pop.setValue(0);
        burst.setValue(0);
        Animated.parallel([
            Animated.spring(pop, { toValue: 1, friction: 4, tension: 120, useNativeDriver: true }),
            Animated.timing(burst, {
                toValue: 1,
                duration: 1100,
                easing: Easing.out(Easing.quad),
                useNativeDriver: true,
            }),
        ]).start();
    }, [visible, pop, burst]);

    return (
        <BlurModal visible={visible} onClose={onClose}>
            <View style={styles.stage}>
                {PARTICLES.map((particle, i) => {
                    const angle = (i / PARTICLES.length) * Math.PI * 2;
                    const distance = 90 + (i % 3) * 20;
                    return (
                        <Animated.Text
                            key={i}
                            style={[
                                styles.particle,
                                {
                                    opacity: burst.interpolate({
                                        inputRange: [0, 0.1, 0.8, 1],
                                        outputRange: [0, 1, 1, 0],
                                    }),
                                    transform: [
                                        {
                                            translateX: burst.interpolate({
                                                inputRange: [0, 1],
                                                outputRange: [0, Math.cos(angle) * distance],
                                            }),
                                        },
                                        {
                                            translateY: burst.interpolate({
                                                inputRange: [0, 1],
                                                outputRange: [0, Math.sin(angle) * distance],
                                            }),
                                        },
                                    ],
                                },
                            ]}>
                            {particle}
                        </Animated.Text>
                    );
                })}
                <Animated.Text style={[styles.hero, { transform: [{ scale: pop }] }]}>{emoji}</Animated.Text>
            </View>
            <ThemedText size="xlarge" weight="strong" align="center">
                {title}
            </ThemedText>
            <ThemedText color="muted" align="center" style={styles.message}>
                {message}
            </ThemedText>
            <Button label="Keep going" onPress={onClose} style={styles.button} />
        </BlurModal>
    );
};

const styles = StyleSheet.create({
    stage: {
        width: 120,
        height: 120,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: spacing.md,
    },
    particle: {
        position: 'absolute',
        fontSize: 20,
    },
    hero: {
        fontSize: 72,
        lineHeight: 90,
    },
    message: {
        marginTop: spacing.sm,
        marginBottom: spacing.lg,
    },
    button: {
        alignSelf: 'stretch',
    },
});

export default Celebration;
