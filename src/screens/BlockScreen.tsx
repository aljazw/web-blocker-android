import { StyleSheet, View, ActivityIndicator, Pressable, NativeModules } from "react-native";
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
import { spacing } from "../theme/tokens";
import { ThemedText } from "../components/ThemedText";


const { SharedStorage} = NativeModules;


const BlockScreen: React.FC = () => {
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
        <BaseScreen title="Add Site" showHeader={false}>
            <View style={{marginTop: spacing.lg, marginHorizontal: spacing.sm}}>
                <SearchBar placeholder="Find website..." onSearch={setSearchQuery}/>
            </View>
                {searchQuery.length === 0 ? (
                   <GuideContainer />
                ) : (
                    loading? (
                        <ActivityIndicator size="large" color="#0000ff" />
                    ) : (websiteUrl.length > 0) ? (
                        <View>
                            <Pressable onPress={() => setNext(prev => !prev)}>
                                <ItemContainer>
                                    <View style={styles.websiteContainer}>
                                        <Favicon url={websiteUrl}/>
                                        <ThemedText weight="medium" size="large">{websiteUrl}</ThemedText>
                                    </View>
                                    <View style={styles.plusIconContainer}>
                                            {next ? (
                                                <Icon name="Selected" tint={false}  size={35}/>
                                            ) : (
                                                <Icon name="Plus" size={20} opacity="faded"/>
                                            )}
                                    </View>
                                </ItemContainer>
                            </Pressable>
                            {next && (
                                <NextButton onPress={handlePressNext} />
                            )}
                        </View>
                    ) : (
                        <View style={{marginHorizontal: spacing.md, marginVertical: spacing.sm}}>
                            <ThemedText>No results found for "{searchQuery}"</ThemedText>
                        </View>
                        
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
            <ThemedText size="large" weight="medium">Guide</ThemedText>
            <View style={{marginTop: spacing.sm}}>
                <ThemedText size="small">
                    1. Enter the domain name or URL without "https://" or "www". Instead of adding <ThemedText weight="strong" color="primaryBlue" size="small">https://www.facebook.com</ThemedText>, just type <ThemedText weight="strong" color="primaryBlue" size="small">facebook.com</ThemedText>.
                </ThemedText>
            </View>
            <View style={{marginVertical: spacing.xs}}>
                <ThemedText size="small">
                    2. If you need a specific webpage or directory, type it directly. For example, enter <ThemedText weight="strong" color="primaryBlue" size="small">facebook.com/home</ThemedText> to access a particular section.
                </ThemedText>
            </View>
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
            <ThemedText style={{textAlign: 'center'}}><ThemedText color="primaryBlue" weight="strong">{websiteUrl}</ThemedText> is already blocked. No need to add it again!</ThemedText>
            <ActionButton variant="cancel" onPress={onClose} style={{marginTop: spacing.lg}}/>
        </BlurModal>
    );
};

const styles = StyleSheet.create({
    websiteContainer: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
    },
    plusIconContainer: {
        alignItems: 'center',
        marginRight: spacing.xs,
    },
});


export default BlockScreen;