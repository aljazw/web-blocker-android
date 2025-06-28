import { useState } from 'react';
import { Image, ImageStyle } from 'react-native';

interface FaviconsProps {
    url: string;
    size?: number;
    style?: ImageStyle;
}

const Favicon: React.FC<FaviconsProps> = ({ url, size = 24, style }) => {
    const [useFallback, setUseFallback] = useState(false);

    const getFaviconUrl = (cleanUrl: string): string | undefined => {
        if (!cleanUrl) {
            return undefined;
        }
        try {
            cleanUrl = url.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
            return `https://www.google.com/s2/favicons?domain=${cleanUrl}`;
        } catch (error) {
            return undefined;
        }
    };

    const faviconUri = getFaviconUrl(url);

    return (
        <Image
            source={useFallback || !faviconUri ? require('../assets/icons/default-favicon.png') : { uri: faviconUri }}
            onError={() => setUseFallback(true)}
            style={[{ width: size, height: size }, style]}
            resizeMode="contain"
        />
    );
};

export default Favicon;
