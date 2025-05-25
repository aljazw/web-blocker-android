import { StyleSheet, Text, View, ActivityIndicator, Pressable, NativeModules } from "react-native";
import BaseScreen from "../components/BaseScreen";
import React, { useState, useEffect } from "react";
import SearchBar from "../components/SearchBar";
import Icon from "../components/Icon";
import { useNavigation } from "@react-navigation/native";
import { RootStackNavigation } from "../types/types";
import NextButton from "../components/NextButton";
import ItemContainer from "../components/itemContainer";
import Favicon from "../components/Favicon";
import BlurModal from "../components/BlurModal";
import ActionButton from "../components/ActionButton";
import { denormalizeUrl, normalizeUrl } from "../utils/urlHelpers";

const { SharedStorage} = NativeModules;


const AddSiteScreen: React.FC = () => {
    const [searchQuery, setSearchQuery] = useState('');
    const [websiteUrl, setWebsiteUrl] = useState<string>('');
    const [loading, setLoading] = useState(false);
    const [next, setNext] = useState(false);
    const [errorPopupVisible ,setErrorPopupVisible] = useState(false);

    const navigation = useNavigation<RootStackNavigation>();

    const handlePressNext = async () => {
        try {
            const existingData = await SharedStorage.getItem('@blocked_websites');
            const websites = existingData ? JSON.parse(existingData) : [];

            const alreadyBlocked = websites.some((site: {websiteUrl: string }) => site.websiteUrl === websiteUrl);

            if (alreadyBlocked) {
                setErrorPopupVisible(true);
                return;
            }
            navigation.navigate('BottomTabs')
        } catch (error) {
            console.error('Error saving blocked website data', error);
        }

        navigation.navigate('Schedule',  {websiteUrl: websiteUrl});
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
                                        <Text style={styles.websiteUrlText} >{websiteUrl}</Text>
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
            <ErrorPopup 
                visible={errorPopupVisible}
                websiteUrl={websiteUrl}
                onClose={() => setErrorPopupVisible(false)}
            />
        </BaseScreen>
    );
};

const GuideContainer = () => {
    return (
        <ItemContainer style={{ flexDirection: 'column', alignItems: 'flex-start'}}>
            <Text style={styles.guideTitleText}>Guide</Text>
            <Text style={styles.guideText} >
                1. Enter the domain name or URL without "https://" or "www". Instead of adding <Text style={styles.guideLinkText}>https://www.facebook.com</Text>, just type <Text style={styles.guideLinkText}>facebook.com</Text>.
            </Text>
            <Text style={styles.guideText} >
                2. If you need a specific webpage or directory, type it directly. For example, enter <Text style={styles.guideLinkText}>facebook.com/home</Text> to access a particular section.
            </Text>
        </ItemContainer>
    );
};


interface ErrorPopupProps {
    visible: boolean;
    websiteUrl: string;
    onClose: () => void;
}

const ErrorPopup:React.FC<ErrorPopupProps> = ({ visible, websiteUrl, onClose }) => {
    return (
        <BlurModal visible={visible} onClose={onClose} >
            <Text style={styles.errorPopoutText}><Text style={styles.errorPopupLinkText}>{websiteUrl}</Text> is already blocked. No need to add it again!</Text>
            <ActionButton variant="cancel" onPress={onClose} />
        </BlurModal>
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
    websiteContainer: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
    },
    plusIconContainer: {
        alignItems: 'center',
        marginRight: 3,
    },
    websiteUrlText: {
        fontWeight: '600',
        fontSize: 16,
        color: '#2f4f4f'
    },
    guideTitleText: {
        fontWeight: 'bold',
        fontSize: 18,
        color: '#333',
        marginBottom: 10,
    },
    guideText: {
        fontSize: 14,
        color: '#555',
        marginBottom: 10,
    },
    guideLinkText: {
        color: '#1E90FF',    
        fontWeight: 'bold',
    },
    errorPopoutText: {
        textAlign: 'center',
        marginBottom: 18,
        fontSize: 14,
    },
    errorPopupLinkText: {
        fontWeight: 'bold',
        fontSize: 16,
    },

});


export default AddSiteScreen;