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
import PassphrasePopup from "../components/PassphrasePopup";
import { usePassphrase } from "../context/PassphraseContext";


const { SharedStorage} = NativeModules;


const HomeScreen: React.FC = () => {

    const [websites, setWebsites] = useState<BlockedWebsitesData[]>([]);
    const [removeSelectedWebsite, setRemoveSelectedWebsite] = useState<string | null>(null);
    const [hideSelectedWebsite, setHideSelectedWebsite] = useState<string | null>(null);

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
                    <ThemedText style={styles.noBlockedWebsiteText}>No Blocked Webistes</ThemedText>
                ) :  (
                    <View>
                        {websites.map((website, index) => (
                            website.visible && (
                                <ItemContainer key={index}>
                                    <View style={styles.innerLeftContainer}>
                                        <Favicon url={website.websiteUrl}/>
                                        <ThemedText weight="medium" size="large">{website.websiteUrl}</ThemedText>
                                    </View>
                                    <View style={{flexDirection: 'row'}}>
                                        <Pressable onPress={() => setHideSelectedWebsite(website.websiteUrl) } >
                                            <Icon name={"Hide"} opacity="faded" style={styles.hideIcon}/>
                                        </Pressable>
                                        <Pressable onPress={() => setRemoveSelectedWebsite(website.websiteUrl) } >
                                            <Icon name={"Trash"} opacity="faded"/>
                                        </Pressable>
                                    </View>
                                </ItemContainer>
                            )
                        ))}
                    </View>
                )}
            </View>
            {removeSelectedWebsite && (
                <PopupRemove
                    visible={!!removeSelectedWebsite}
                    onClose={() => setRemoveSelectedWebsite(null)}
                    url={removeSelectedWebsite}
                    setRemoveSelectedWebsites={setRemoveSelectedWebsite}
                    getWebsitesData={getWebsitesData}
                />
            )}
            {hideSelectedWebsite && (
                <PopupHide 
                    onClose={() => setHideSelectedWebsite(null)}
                    visible={!!hideSelectedWebsite}
                    url={hideSelectedWebsite}
                    setHideSelectedWebsite={() => setHideSelectedWebsite(null)}
                    getWebsitesData={getWebsitesData}
                />
            )}
        </BaseScreen>
    );
};

interface PopupRemoveProps {
    url: string;
    visible: boolean;
    onClose: () => void;
    setRemoveSelectedWebsites: React.Dispatch<React.SetStateAction<string | null>>;
    getWebsitesData: () => void;
}

const PopupRemove: React.FC<PopupRemoveProps> = ({
    url,
    visible,
    onClose,
    setRemoveSelectedWebsites: setSelectedWebsites,
    getWebsitesData
}) => {

    const { isEnabled } = usePassphrase();
    const [showPassphrasePopup, setShowPassphrasePopup] = useState(false);

    const handleInitialConfirm = () => {
        if (isEnabled) {
            setShowPassphrasePopup(true); 
        } else {
            onConfirm();
        }
    };

    const handlePassphraseConfirm = () => {
        setShowPassphrasePopup(false);
        onConfirm();
    };

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
        <>
            <BlurModal visible={visible} onClose={onClose}>
                <ThemedText style={{textAlign: 'center'}}>Are you sure you want to remove <ThemedText color="primaryBlue" weight="strong" size="large">{url}</ThemedText> from your block list?</ThemedText>
                <View style={styles.popupButtonsContainer}> 
                    <ActionButton variant="cancel" onPress={onClose} />
                    <ActionButton variant="confirm" onPress={handleInitialConfirm}/>
                </View>
            </BlurModal>

            <PassphrasePopup 
                visible={showPassphrasePopup}
                onClose={() => setShowPassphrasePopup(false)}
                onConfirm={handlePassphraseConfirm}
            />
        </>
    );
};

interface PopupVisibleProps {
    onClose: () => void;
    visible: boolean;
    url: string;
    setHideSelectedWebsite: React.Dispatch<React.SetStateAction<string | null>>;
    getWebsitesData: () => void;
};

const PopupHide: React.FC<PopupVisibleProps> = ({
    onClose, 
    visible, 
    url, 
    setHideSelectedWebsite,
    getWebsitesData
}) => {

    const onConfirm = async () => {
        try {
            const existingData = await SharedStorage.getItem('@blocked_websites');
            const websites = existingData ? JSON.parse(existingData) : [];
            const updatedWebsites = websites.map((site: { websiteUrl: string; visible: boolean }) => {
                if (site.websiteUrl == url) {
                    return {...site, visible: false};
                }
                return site;
            });

            await SharedStorage.setItem('@blocked_websites', JSON.stringify(updatedWebsites));
            setHideSelectedWebsite(null);
            getWebsitesData();
            onClose();
        } catch (error) {
            console.log('Error deleting selected website', error)
        }
    }

    return (
        <BlurModal visible={visible} onClose={() => onClose}>
            <ThemedText weight="strong" size="large" align="center">
                Are you sure you want to make <ThemedText weight="strong" size="large" color="primaryBlue">{url}</ThemedText> invisible?
            </ThemedText>
            <ThemedText weight="strong" color="primaryRed" align="center" style={{marginTop: spacing.md}}>
                Once hidden, you won’t be able to remove it unless you clear the app’s data 
                through your device settings!
            </ThemedText>
            <View style={styles.popupButtonsContainer}> 
                <ActionButton variant="cancel" onPress={onClose} />
                <ActionButton variant="confirm" onPress={onConfirm}/>
            </View>
        </BlurModal>
    );
};

const styles = StyleSheet.create({
    innerLeftContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    hideIcon: {
        marginRight: spacing.sm,
    },
    popupButtonsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: spacing.lg,
    },
    noBlockedWebsiteText: {
        marginLeft: spacing.md, marginTop: spacing.xs
    },
    hidePopupText: {
        textAlign: 'center',
    },
});

export default HomeScreen;
