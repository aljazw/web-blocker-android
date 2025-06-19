import { TextProps, TextStyle } from "react-native";
import { useTheme } from "../theme";
import { Text } from "react-native-gesture-handler";

type TextSize = 'small' | 'normal' | 'large' | 'xlarge';
type TextWeight = 'light' | 'regular' | 'medium' | 'strong';
type TextOpacity = 'normal' | 'muted' | 'faded';
type ColorToken = 'text' | 'primaryRed' | 'primaryBlue' | 'primaryGreen';


interface Props extends TextProps {
    size?: TextSize;
    weight?: TextWeight;
    opacity?: TextOpacity;
    color?: ColorToken;
    style?: TextStyle | TextStyle[];
    children: React.ReactNode
}

export const ThemedText: React.FC<Props> = ({
    size = 'normal',
    weight = 'regular',
    opacity = 'normal',
    color = 'text',
    style,
    children,
    ...rest
}) => {
    const { theme } = useTheme();

    const sizeMap: Record<TextSize, number> = {
        small: 13,
        normal: 15,
        large: 17,
        xlarge: 24,
    };

    const weightMap: Record<TextWeight, TextStyle['fontWeight']> = {
        light: '300',
        regular: '400',
        medium: '600',
        strong: '800'
    };

    const opacityMap: Record<TextOpacity, number> = {
        normal: 1,
        muted: 0.8,
        faded: 0.6,
    };

    const fontSize = sizeMap[size];
    const fontWeight = weightMap[weight];
    const fontOpacity = opacityMap[opacity];
    const fontColor = theme.colors[color];


    return (
        <Text
            {...rest}
            style={[
                { 
                    fontSize, 
                    fontWeight, 
                    opacity: fontOpacity,  
                    color: fontColor 
                },
                style,
            ]}
        >
            {children}
        </Text>
    );
};