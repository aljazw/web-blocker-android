import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { AnimatedBar } from './Motion';

interface ProgressBarProps {
    /** 0–1. */
    fraction: number;
    color?: string;
    height?: number;
    style?: StyleProp<ViewStyle>;
}

/** Thin animated progress track. */
const ProgressBar: React.FC<ProgressBarProps> = ({ fraction, color, height = 4, style }) => {
    const { colors } = useTheme().theme;
    return (
        <View style={[styles.track, { height, borderRadius: height / 2, backgroundColor: colors.elevated }, style]}>
            <AnimatedBar
                fraction={Math.max(0, Math.min(1, fraction))}
                color={color ?? colors.accent}
                style={[styles.fill, { borderRadius: height / 2 }]}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    track: {
        overflow: 'hidden',
    },
    fill: {
        height: '100%',
    },
});

export default ProgressBar;
