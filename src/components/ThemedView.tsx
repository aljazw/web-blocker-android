import { StyleProp, View, ViewStyle } from 'react-native';
import { shapes } from '../theme';
import { useTheme } from '../context/ThemeContext';

interface ThemedViewProps {
    style?: StyleProp<ViewStyle>;
    withBorder?: boolean;
    color?: Color;
    children?: React.ReactNode;
}

type Color = 'background' | 'card';

export const ThemedView: React.FC<ThemedViewProps> = ({ style, withBorder, color = 'card', children, ...rest }) => {
    const { theme } = useTheme();

    return (
        <View
            {...rest}
            style={[
                {
                    backgroundColor: theme.colors[color],
                    ...(withBorder
                        ? {
                              borderColor: theme.colors.border,
                              borderWidth: shapes.borderWidth.thin,
                          }
                        : {}),
                },
                style,
            ]}>
            {children}
        </View>
    );
};
