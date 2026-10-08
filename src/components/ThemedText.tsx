import { StyleProp, StyleSheet, Text, TextProps, TextStyle } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { ThemeColors } from '../theme/types';

export type TextSize = 'tiny' | 'small' | 'normal' | 'large' | 'xlarge' | 'display' | 'hero';
export type TextWeight = 'light' | 'regular' | 'medium' | 'strong' | 'bold';
type TextOpacity = 'normal' | 'muted' | 'faded';
type TextAlign = 'left' | 'center' | 'right' | 'auto';
type ColorToken = keyof Pick<
    ThemeColors,
    'text' | 'muted' | 'accent' | 'onAccent' | 'primaryRed' | 'primaryBlue' | 'primaryGreen' | 'warning'
>;

export interface ThemedTextProps extends TextProps {
    size?: TextSize;
    weight?: TextWeight;
    opacity?: TextOpacity;
    align?: TextAlign;
    color?: ColorToken;
    /** Fixed-width digits, so timers and counters don't jitter. */
    tabular?: boolean;
    /** Small uppercase label style (section titles, eyebrows). */
    caps?: boolean;
    style?: StyleProp<TextStyle>;
    children: React.ReactNode;
}

const SIZE: Record<TextSize, number> = {
    tiny: 11,
    small: 13,
    normal: 15,
    large: 17,
    xlarge: 22,
    display: 32,
    hero: 64,
};

const WEIGHT: Record<TextWeight, TextStyle['fontWeight']> = {
    light: '300',
    regular: '400',
    medium: '500',
    strong: '600',
    bold: '700',
};

const OPACITY: Record<TextOpacity, number> = {
    normal: 1,
    muted: 0.8,
    faded: 0.6,
};

/** Tighter tracking on large type, wider on small caps — standard typographic practice. */
const tracking = (size: TextSize, caps: boolean) => {
    if (caps) {
        return 0.8;
    }
    if (size === 'hero') {
        return -2;
    }
    if (size === 'display') {
        return -0.8;
    }
    if (size === 'xlarge') {
        return -0.4;
    }
    return 0;
};

export const ThemedText: React.FC<ThemedTextProps> = ({
    size = 'normal',
    weight = 'regular',
    opacity = 'normal',
    align = 'auto',
    color = 'text',
    tabular,
    caps = false,
    style,
    children,
    ...rest
}) => {
    const { theme } = useTheme();

    return (
        <Text
            {...rest}
            style={[
                {
                    fontSize: SIZE[size],
                    fontWeight: WEIGHT[weight],
                    opacity: OPACITY[opacity],
                    textAlign: align,
                    color: theme.colors[color],
                    letterSpacing: tracking(size, caps),
                },
                caps && styles.caps,
                tabular && styles.tabular,
                style,
            ]}>
            {children}
        </Text>
    );
};

const styles = StyleSheet.create({
    caps: {
        textTransform: 'uppercase',
    },
    tabular: {
        fontVariant: ['tabular-nums'],
    },
});
