import { Animated, StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useTheme } from '../context/ThemeContext';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface ProgressRingProps {
    size: number;
    strokeWidth?: number;
    /** 0–1, as a number or an Animated.Value for smooth animation. */
    progress: number | Animated.Value | Animated.AnimatedInterpolation<number>;
    color: string;
    children?: React.ReactNode;
}

/** Circular progress track that fills clockwise from the top. */
const ProgressRing: React.FC<ProgressRingProps> = ({ size, strokeWidth = 8, progress, color, children }) => {
    const { colors } = useTheme().theme;
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const offset =
        typeof progress === 'number'
            ? circumference * (1 - Math.max(0, Math.min(1, progress)))
            : progress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [circumference, 0],
                  extrapolate: 'clamp',
              });

    return (
        <View style={{ width: size, height: size }}>
            <Svg width={size} height={size} style={styles.rotate}>
                <Circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    stroke={colors.elevated}
                    strokeWidth={strokeWidth}
                    fill="none"
                />
                <AnimatedCircle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    stroke={color}
                    strokeWidth={strokeWidth}
                    strokeLinecap="round"
                    fill="none"
                    strokeDasharray={`${circumference} ${circumference}`}
                    strokeDashoffset={offset}
                />
            </Svg>
            <View style={styles.center}>{children}</View>
        </View>
    );
};

const styles = StyleSheet.create({
    rotate: {
        transform: [{ rotate: '-90deg' }],
    },
    center: {
        ...StyleSheet.absoluteFillObject,
        alignItems: 'center',
        justifyContent: 'center',
    },
});

export default ProgressRing;
