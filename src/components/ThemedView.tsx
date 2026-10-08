import { StyleProp, View, ViewProps, ViewStyle } from 'react-native';
import { shapes } from '../theme';
import { useTheme } from '../context/ThemeContext';

type Surface = 'background' | 'card' | 'elevated';

interface ThemedViewProps extends ViewProps {
    style?: StyleProp<ViewStyle>;
    withBorder?: boolean;
    color?: Surface;
    children?: React.ReactNode;
}

export const ThemedView: React.FC<ThemedViewProps> = ({ style, withBorder, color = 'card', children, ...rest }) => {
    const { theme } = useTheme();

    return (
        <View
            {...rest}
            style={[
                { backgroundColor: theme.colors[color] },
                withBorder && { borderColor: theme.colors.border, borderWidth: shapes.borderWidth.thin },
                style,
            ]}>
            {children}
        </View>
    );
};
