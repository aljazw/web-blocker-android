import { NativeModules, Pressable, StyleSheet, View } from "react-native";
import BaseScreen from "../components/BaseScreen"
import React, { useEffect, useState } from "react";
import { BlockedWebsitesData } from "../types/types";
import ItemContainer from "../components/itemContainer";
import Favicon from "../components/Favicon";
import Icon from "../components/Icon";
import ActionButton from "../components/ActionButton";
import BlurModal from "../components/BlurModal";
import { spacing } from "../theme";
import { ThemedText } from "../components/ThemedText";


const { SharedStorage} = NativeModules;


const HomeScreen: React.FC = () => {

    const [websites, setWebsites] = useState<BlockedWebsitesData[]>([]);
    const [selectedWebsite, setSelectedWebsite] = useState<string | null>(null);

    const getWebsitesData = async () => {
        try {
            const existingData = await SharedStorage.getItem('@blocked_websites');
            const websitesData = existingData ? JSON.parse(existingData) : [];
            setWebsites(websitesData);
        } catch (error) {
            console.log('Error fetching existing website data', error)
        }
    };

    useEffect(()=> {
        getWebsitesData();
    }, []);


    return (
        <BaseScreen title="Home Screen">
            <View>
                {websites.length === 0 ? (
                    <ThemedText>No Blocked Webistes</ThemedText>
                ) :  (
                    <View>
                        {websites.map((website, index) => (
                            <ItemContainer key={index}>
                                <View style={styles.innerLeftContainer}>
                                    <Favicon url={website.websiteUrl}/>
                                    <ThemedText weight="medium" size="large">{website.websiteUrl}</ThemedText>
                                </View>
                                <Pressable onPress={() => setSelectedWebsite(website.websiteUrl) } >
                                    <Icon name={"Trash"} style={styles.trashIcon}/>
                                </Pressable>
                            </ItemContainer>
                        ))}
                    </View>
                )}
            </View>
            {selectedWebsite && (
                <Popup
                    url={selectedWebsite}
                    visible={!!selectedWebsite}
                    onClose={() => setSelectedWebsite(null)}
                    setSelectedWebsites={setSelectedWebsite}
                    getWebsitesData={getWebsitesData}
                />
            )}
        </BaseScreen>
    );
};

interface PopupProps {
    url: string;
    visible: boolean;
    onClose: () => void;
    setSelectedWebsites: React.Dispatch<React.SetStateAction<string | null>>;
    getWebsitesData: () => void;
}

const Popup: React.FC<PopupProps> = ({url, visible, onClose, setSelectedWebsites, getWebsitesData, }) => {

    const onConfirm = async () => {
        try {
            const existingData = await SharedStorage.getItem('@blocked_websites');
            const websites = existingData ? JSON.parse(existingData) : [];
            const updatedWebsites = websites.filter((site: { websiteUrl: string }) => site.websiteUrl !== url);

            await SharedStorage.setItem('@blocked_websites', JSON.stringify(updatedWebsites));
            setSelectedWebsites(null);
            getWebsitesData();
            onClose();
        } catch (error) {
            console.log('Error deleting selected website', error)
        }
    }

    return(
        <BlurModal visible={visible} onClose={onClose}>
            <ThemedText style={{textAlign: 'center'}}>Are you sure you want to remove <ThemedText color="primaryBlue" weight="strong" size="large">{url}</ThemedText> from your block list?</ThemedText>
            <View style={styles.popupButtonsContainer}> 
                <ActionButton variant="cancel" onPress={onClose} />
                <ActionButton variant="confirm" onPress={onConfirm} />
            </View>
        </BlurModal>
    );
};

const styles = StyleSheet.create({
    innerLeftContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    trashIcon: {
        opacity: 0.5,
    },
    popupButtonsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: spacing.lg,
    },
});

export default HomeScreen;
