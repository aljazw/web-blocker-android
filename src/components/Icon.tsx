import { Image, ImageStyle, StyleProp } from 'react-native';
import { useTheme } from '../context/ThemeContext';

const iconMap: Record<string, any> = {
    Home: require('../assets/icons/home.png'),
    Block: require('../assets/icons/block.png'),
    Settings: require('../assets/icons/settings.png'),
    Search: require('../assets/icons/search.png'),
    Close: require('../assets/icons/close.png'),
    Plus: require('../assets/icons/plus.png'),
    Next: require('../assets/icons/next.png'),
    Selected: require('../assets/icons/selected.png'),
    Calendar: require('../assets/icons/calendar.png'),
    Time: require('../assets/icons/time.png'),
    Arrow: require('../assets/icons/arrow.png'),
    Trash: require('../assets/icons/delete.png'),
    Hide: require('../assets/icons/hide.png'),
};

type IconOpacity = 'normal' | 'muted' | 'faded';

interface IconProps {
    name: string;
    size?: number;
    opacity?: IconOpacity;
    tint?: string | false;
    style?: StyleProp<ImageStyle>;
}

const Icon: React.FC<IconProps> = ({ name, size = 24, opacity = 'normal', tint, style }) => {
    const { isDarkMode } = useTheme();

    let tintColorStyle: { tintColor?: string } = {};
    if (tint === false) {
        tintColorStyle = {};
    } else if (typeof tint === 'string') {
        tintColorStyle = { tintColor: isDarkMode ? tint : '#000' };
    } else {
        tintColorStyle = { tintColor: isDarkMode ? '#fff' : '#000' };
    }

    const opacityMap: Record<IconOpacity, number> = {
        normal: 1,
        muted: 0.8,
        faded: 0.6,
    };

    const IconOpacityValue = opacityMap[opacity];

    return (
        <Image
            source={iconMap[name]}
            resizeMode="contain"
            style={[
                {
                    width: size,
                    height: size,
                    opacity: IconOpacityValue,
                    ...tintColorStyle,
                },
                style,
            ]}
        />
    );
};

export default Icon;
