import { StyleSheet, Text, View, ActivityIndicator, Pressable } from "react-native";
import BaseScreen from "../components/BaseScreen";
import { useState, useEffect } from "react";
import SearchBar from "../components/SearchBar";
import Icon from "../components/Icon";
import { useNavigation } from "@react-navigation/native";
import { RootStackNavigation } from "../types/types";
import NextButton from "../components/NextButton";
import ItemContainer from "../components/itemContainer";
import Favicon from "../components/Favicon";


const AddSiteScreen: React.FC = () => {
    const [searchQuery, setSearchQuery] = useState('');
    const [websiteUrl, setWebsiteUrl] = useState<string>('');
    const [loading, setLoading] = useState(false);
    const [next, setNext] = useState(false);

    
    
    const navigation = useNavigation<RootStackNavigation>();

    const handlePressNext = () => {
        navigation.navigate('Schedule',  {websiteUrl: websiteUrl});
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
        setWebsiteUrl('');
        const normalizedUrl = normalizeUrl(url);

        try {
          const response = await fetch(normalizedUrl);
          if (response.ok) {
            setWebsiteUrl(denormalizeUrl(normalizedUrl))
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
                    ) : (websiteUrl.length > 0) ? (
                        <View>
                            <Pressable onPress={() => setNext(prev => !prev)}>
                                <ItemContainer style={next ? styles.itemContainerSelected : {}}>
                                    <View style={styles.websiteContainer}>
                                        <Favicon url={websiteUrl}/>
                                        <Text style={styles.urlText}>{websiteUrl}</Text>
                                    </View>
                                    <View style={styles.plusIconContainer}>
                                            {next ? (
                                                <Icon name="Selected" size={35} style={{opacity: 0.6}}/>
                                            ) : (
                                                <Icon name="Plus" size={20} style={{opacity: 0.5}}/>
                                            )}
                                    </View>
                                </ItemContainer>
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
    itemContainerSelected: {
        borderColor: '#34C759', 
        backgroundColor: '#E6F9EB', 
        shadowColor: '#34C759', 
        shadowOpacity: 0.3,
        shadowRadius: 5,
        elevation: 5,
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
    guideContainer: {
        backgroundColor: '#f8f9fa', 
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#ddd',
        margin: 16,
        shadowColor: '#000',
        shadowOpacity: 0.1,
        shadowOffset: { width: 0, height: 2 },
        shadowRadius: 4,
        elevation: 3,
    },
    guideTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 10,
        color: '#333',
    },
    guideStep: {
        fontSize: 14,
        color: '#555',
        marginBottom: 8,
    },
    guideHighlight: {
        fontWeight: 'bold',
        color: '#007bff',
    }
});

export default AddSiteScreen;



const GuideContainer = () => {
    return (
        <View style={styles.guideContainer}>
            <Text style={styles.guideTitle}>Guide</Text>
            <Text style={styles.guideStep}>
                1. Enter the domain name or URL without "https://" or "www". Instead of adding <Text style={styles.guideHighlight}>https://www.facebook.com</Text>, just type <Text style={styles.guideHighlight}>facebook.com</Text>.
            </Text>
            <Text style={styles.guideStep}>
                2. If you need a specific webpage or directory, type it directly. For example, enter <Text style={styles.guideHighlight}>facebook.com/home</Text> to access a particular section.
            </Text>
        </View>
    );
};
