import { Text, TextProps, TextStyle } from 'react-native';
import { useTheme } from '../context/ThemeContext';

type TextSize = 'tiny' | 'small' | 'normal' | 'large' | 'xlarge' | 'display';
type TextWeight = 'light' | 'regular' | 'medium' | 'strong';
type TextOpacity = 'normal' | 'muted' | 'faded';
type TextAlign = 'left' | 'center' | 'right' | 'auto';
type ColorToken = 'text' | 'muted' | 'accent' | 'onAccent' | 'primaryRed' | 'primaryBlue' | 'primaryGreen';

interface Props extends TextProps {
    size?: TextSize;
    weight?: TextWeight;
    opacity?: TextOpacity;
    align?: TextAlign;
    color?: ColorToken;
    style?: TextStyle | TextStyle[];
    children: React.ReactNode;
}

export const ThemedText: React.FC<Props> = ({
    size = 'normal',
    weight = 'regular',
    opacity = 'normal',
    align = 'auto',
    color = 'text',
    style,
    children,
    ...rest
}) => {
    const { theme } = useTheme();

    const sizeMap: Record<TextSize, number> = {
        tiny: 11,
        small: 13,
        normal: 15,
        large: 17,
        xlarge: 26,
        display: 34,
    };

    const weightMap: Record<TextWeight, TextStyle['fontWeight']> = {
        light: '300',
        regular: '400',
        medium: '600',
        strong: '700',
    };

    const opacityMap: Record<TextOpacity, number> = {
        normal: 1,
        muted: 0.8,
        faded: 0.6,
    };

    const fontSize = sizeMap[size];
    const fontWeight = weightMap[weight];
    const fontOpacity = opacityMap[opacity];
    const textAlign = align;
    const fontColor = theme.colors[color];

    return (
        <Text
            {...rest}
            style={[
                {
                    fontSize,
                    fontWeight,
                    opacity: fontOpacity,
                    textAlign: textAlign,
                    color: fontColor,
                    letterSpacing: size === 'display' || size === 'xlarge' ? -0.5 : 0,
                },
                style,
            ]}>
            {children}
        </Text>
    );
};
