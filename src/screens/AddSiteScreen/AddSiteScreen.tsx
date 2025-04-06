import { StyleSheet, Text, View, Image, ActivityIndicator, Pressable } from "react-native";
import BaseScreen from "../../components/BaseScreen";
import { useState, useEffect } from "react";
import SearchBar from "../../components/SearchBar";
import GuideContainer from "./GuideContainer";
import Icon from "../../components/Icon";
import { useNavigation } from "@react-navigation/native";
import { RootStackNavigation, Website } from "../../types/types";
import NextButton from "../../components/NextButton";




const AddSiteScreen: React.FC = () => {
    const [searchQuery, setSearchQuery] = useState('');
    const [website, setWebsite] = useState<Website>({url: "", favicon: ""});
    const [loading, setLoading] = useState(false);
    const [next, setNext] = useState(false);

    
    
    const navigation = useNavigation<RootStackNavigation>();

    const handlePressNext = () => {
        navigation.navigate('Schedule', { website } );
    }
    const getFaviconUrl = (url: string): string => {
        try {
            url = url.replace(/^https?:\/\//, "");
            url = url.replace(/\/.*$/, "");
            return `https://www.google.com/s2/favicons?domain=${url}`;
        } catch (error) {
            console.error("Ivalid URL:", error);
            return "/default-favicon.ico" //Fallback favicon
        }
    }

    const normalizeUrl = (url: string): string => {
        if (!url.startsWith("http://") && !url.startsWith("https://")) {
          return `https://${url}`;
        }
        return url;
    };

    const denormalizeUrl = (url: string): string => {
        return url.replace(/^(https?:\/\/)?(www\.)?/, '');
    };
    

    const checkUrl = async (url: string) => {
        setLoading(true);
        setWebsite({url: "", favicon: ""});
        const normalizedUrl = normalizeUrl(url);

        try {
          const response = await fetch(normalizedUrl);
          if (response.ok) {
            setWebsite({
                url: denormalizeUrl(normalizedUrl),
                favicon: getFaviconUrl(url)
            })
          } else {
            console.log('Error', 'The subdirectory does not exist.');
          }
        } catch (error) {
          console.log('Error', 'The subdirectory cannot be reached.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const delayDebounce = setTimeout(() => {
            setLoading(true);
            setNext(false);
            checkUrl(searchQuery);
        }, 600); 

        return () => clearTimeout(delayDebounce);
    }, [searchQuery]);

    return (
        <BaseScreen title="Add Site">
            <SearchBar placeholder="Find website..." onSearch={setSearchQuery} />
                {searchQuery.length === 0 ? (
                   <GuideContainer />
                ) : (
                    loading? (
                        <ActivityIndicator size="large" color="#0000ff" />
                    ) : (website.url.length > 0) ? (
                        <View>
                            <Pressable onPress={() => setNext(prev => !prev)}>
                                <View style={[styles.itemContainer, next && styles.itemContainerSelected]}>
                                    <View style={styles.websiteContainer}>
                                        <Image source={{ uri: website.favicon }} style={styles.favicon} />
                                        <Text style={styles.urlText}>{website.url}</Text>
                                    </View>
                                    <View style={styles.plusIconContainer}>
                                            {next ? (
                                                <Icon name="Selected" size={35} style={{opacity: 0.6}}/>
                                            ) : (
                                                <Icon name="Plus" size={20} style={{opacity: 0.5}}/>
                                            )}
                                    </View>
                                </View>
                            </Pressable>
                            {next && (
                                <NextButton onPress={handlePressNext} />
                            )}
                        </View>
                    ) : (
                        <Text>No results found for "{searchQuery}"</Text>
                    )
                )} 
        </BaseScreen>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
    },
    itemContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginHorizontal: 10,
        marginTop: 20,
        alignItems: 'center',
        padding: 15,
        borderRadius: 10,
        backgroundColor: '#f9f9f9',  
        borderWidth: 1,  
        borderColor: '#e0e0e0',
        shadowColor: '#000',
        shadowOpacity: 0.1,
        shadowOffset: { width: 0, height: 2 },
        shadowRadius: 4,
        elevation: 3, // Shadow effect for Android
    },
    itemContainerSelected: {
        borderColor: '#34C759', 
        backgroundColor: '#E6F9EB', 
        shadowColor: '#34C759', 
        shadowOpacity: 0.3,
        shadowRadius: 5,
        elevation: 5,
    },
    favicon: {
        width: 32,  
        height: 32,
        marginRight: 12,
        borderRadius: 5, 
    },
    urlText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',  
    },
    websiteContainer: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
    },
    plusIconContainer: {
        alignItems: 'center',
        marginRight: 3,
    },
});

export default AddSiteScreen;
