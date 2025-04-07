import { Image, ImageStyle, StyleProp } from "react-native";

const iconMap: Record<string, any> = {
    Home: require('../assets/icons/home.png'),
    Block: require('../assets/icons/block.png'),
    Profile: require('../assets/icons/user.png'),
    Search: require('../assets/icons/search.png'),
    Close: require('../assets/icons/close.png'),
    Plus: require('../assets/icons/plus.png'),
    Next: require('../assets/icons/next.png'),
    Selected: require('../assets/icons/selected.png'),
    Calendar: require('../assets/icons/calendar.png'),
    Time: require('../assets/icons/time.png'),
    Arrow: require('../assets/icons/arrow.png'),

};

interface IconProps {
    name: string;
    size?: number;
    style?: StyleProp<ImageStyle>;
}

const Icon: React.FC<IconProps> = ({ name, size = 24, style }) => {
    return (
        <Image
            source={iconMap[name]}
            style={[{width: size, height: size, resizeMode: 'contain'}, style]}
        />
    );
};

export default Icon;