import { useEffect, useState } from 'react';
import { Image, StyleProp, View, ViewStyle } from 'react-native';
import { getAppIcon } from '../utils/installedApps';
import { useTheme } from '../context/ThemeContext';
import Icon from './Icon';

interface AppIconProps {
    packageName: string;
    size?: number;
    style?: StyleProp<ViewStyle>;
}

/** An installed app's launcher icon, with a neutral placeholder while loading or if it's uninstalled. */
const AppIcon: React.FC<AppIconProps> = ({ packageName, size = 24, style }) => {
    const { theme } = useTheme();
    const [uri, setUri] = useState<string | null>(null);

    useEffect(() => {
        let alive = true;
        getAppIcon(packageName).then(result => alive && setUri(result));
        return () => {
            alive = false;
        };
    }, [packageName]);

    if (!uri) {
        return (
            <View style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]}>
                <Icon name="Apps" size={size * 0.8} tint={theme.colors.muted} />
            </View>
        );
    }
    return <Image source={{ uri }} style={[{ width: size, height: size }, style as object]} />;
};

export default AppIcon;
