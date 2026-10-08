import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { shapes } from '../theme';
import { useTheme } from '../context/ThemeContext';
import Icon, { IconName } from './Icon';

interface IconTileProps {
    /** An icon name, or custom content (favicon, app icon) via children. */
    icon?: IconName;
    size?: number;
    /** Icon color; the tile gets a matching soft background. Defaults to the accent. */
    tone?: 'accent' | 'neutral' | 'danger' | 'success';
    children?: React.ReactNode;
    style?: StyleProp<ViewStyle>;
}

/** Rounded square that holds a leading icon in lists and cards. */
const IconTile: React.FC<IconTileProps> = ({ icon, size = 36, tone = 'neutral', children, style }) => {
    const { colors } = useTheme().theme;
    const palette = {
        accent: { bg: colors.accentSoft, fg: colors.accent },
        neutral: { bg: colors.elevated, fg: colors.text },
        danger: { bg: colors.redSoft, fg: colors.primaryRed },
        success: { bg: colors.greenSoft, fg: colors.primaryGreen },
    }[tone];

    return (
        <View
            style={[
                styles.tile,
                { width: size, height: size, borderRadius: size * 0.28, backgroundColor: palette.bg },
                style,
            ]}>
            {children ?? (icon ? <Icon name={icon} size={Math.round(size * 0.5)} tint={palette.fg} /> : null)}
        </View>
    );
};

const styles = StyleSheet.create({
    tile: {
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: shapes.borderRadius.medium,
    },
});

export default IconTile;
