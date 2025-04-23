import { Image, ImageStyle, StyleSheet } from "react-native";


interface FaviconsProps {
    url: string;
    size?: number;
    style?: ImageStyle;

}

const Favicon: React.FC<FaviconsProps> = ({ url, size = 24 , style }) => {

    const getFaviconUrl = (url: string): string => {
        try {
            url = url.replace(/^https?\/\//, "");
            url = url.replace(/\/.*$/, "");
            return `https://www.google.com/s2/favicons?domain=${url}`;
        } catch (error) {
            console.error("Invalid URL:", error);
            return '';
        }

    };
   

    return (
        <Image source={{uri: getFaviconUrl(url)}} style={[styles.favicon, style, {width:size, height:size}]}/>
    )
}

export default Favicon;

const styles = StyleSheet.create({
    favicon: {
        resizeMode: 'contain',
        margin: 2,
        marginRight: 12,
        borderRadius: 5, 
    },
});
