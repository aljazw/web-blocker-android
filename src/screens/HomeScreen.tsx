import { Pressable, StyleSheet, View, ScrollView } from 'react-native';
import BaseScreen from '../components/BaseScreen';
import React, { useCallback, useEffect, useState } from 'react';
import { BlockedWebsitesData } from '../types/types';
import ItemContainer from '../components/itemContainer';
import Favicon from '../components/Favicon';
import Icon from '../components/Icon';
import ActionButton from '../components/ActionButton';
import BlurModal from '../components/BlurModal';
import { spacing } from '../theme';
import { ThemedText } from '../components/ThemedText';
import PassphrasePopup from '../components/PassphrasePopup';
import { usePassphrase } from '../context/PassphraseContext';
import ErrorPopup from '../components/ErrorPopup';
import { deleteBlockedWebsite, getBlockedWebsites, hideBlockedWebsite } from '../utils/storage';
import { ERRORS } from '../constants/strings';

const HomeScreen: React.FC = () => {
    const [websites, setWebsites] = useState<BlockedWebsitesData[]>([]);
    const [removeSelectedWebsite, setRemoveSelectedWebsite] = useState<string | null>(null);
    const [hideSelectedWebsite, setHideSelectedWebsite] = useState<string | null>(null);
    const [errorPopupVisible, setErrorPopupVisible] = useState(false);
    const [errorTitle, setErrorTitle] = useState('');
    const [errorText, setErrorText] = useState('');

    const showError = (title: string, text: string) => {
        setErrorTitle(title);
        setErrorText(text);
        setErrorPopupVisible(true);
    };

    const getWebsitesData = useCallback(async () => {
        try {
            const websitesData = await getBlockedWebsites();
            setWebsites(websitesData);
        } catch {
            showError(ERRORS.dataLoadError.title, ERRORS.dataLoadError.text);
        }
    }, []);

    useEffect(() => {
        getWebsitesData();
    }, [getWebsitesData]);

    return (
        <BaseScreen title="Home Screen">
            <View>
                {websites.length === 0 ? (
                    <ThemedText style={styles.noBlockedWebsiteText}>No Blocked Webistes</ThemedText>
                ) : (
                    <ScrollView contentContainerStyle={styles.scrollContainer}>
                        {websites.map(
                            (website, index) =>
                                website.visible && (
                                    <ItemContainer key={index}>
                                        <View style={styles.innerLeftContainer}>
                                            <Favicon url={website.websiteUrl} style={styles.favicon} />
                                            <ThemedText weight="medium" size="large">
                                                {website.websiteUrl}
                                            </ThemedText>
                                        </View>
                                        <View style={styles.innerRightContainer}>
                                            <Pressable onPress={() => setHideSelectedWebsite(website.websiteUrl)}>
                                                <Icon name={'Hide'} opacity="faded" style={styles.hideIcon} />
                                            </Pressable>
                                            <Pressable onPress={() => setRemoveSelectedWebsite(website.websiteUrl)}>
                                                <Icon name={'Trash'} opacity="faded" />
                                            </Pressable>
                                        </View>
                                    </ItemContainer>
                                ),
                        )}
                    </ScrollView>
                )}
            </View>
            {removeSelectedWebsite && (
                <PopupRemove
                    visible={!!removeSelectedWebsite}
                    onClose={() => setRemoveSelectedWebsite(null)}
                    url={removeSelectedWebsite}
                    setRemoveSelectedWebsites={setRemoveSelectedWebsite}
                    getWebsitesData={getWebsitesData}
                    showError={() => showError(ERRORS.dataLoadError.title, ERRORS.dataLoadError.text)}
                />
            )}
            {hideSelectedWebsite && (
                <PopupHide
                    onClose={() => setHideSelectedWebsite(null)}
                    visible={!!hideSelectedWebsite}
                    url={hideSelectedWebsite}
                    setHideSelectedWebsite={() => setHideSelectedWebsite(null)}
                    getWebsitesData={getWebsitesData}
                    showError={() => showError(ERRORS.genericRetrieveError.title, ERRORS.genericRetrieveError.text)}
                />
            )}
            <ErrorPopup
                title={errorTitle}
                text={errorText}
                visible={errorPopupVisible}
                onClose={() => setErrorPopupVisible}
            />
        </BaseScreen>
    );
};

interface PopupRemoveProps {
    url: string;
    visible: boolean;
    onClose: () => void;
    setRemoveSelectedWebsites: React.Dispatch<React.SetStateAction<string | null>>;
    getWebsitesData: () => void;
    showError: () => void;
}

const PopupRemove: React.FC<PopupRemoveProps> = ({
    url,
    visible,
    onClose,
    setRemoveSelectedWebsites: setSelectedWebsites,
    getWebsitesData,
    showError,
}) => {
    const { isPassphraseEnabled } = usePassphrase();
    const [showPassphrasePopup, setShowPassphrasePopup] = useState(false);

    const handleInitialConfirm = () => {
        if (isPassphraseEnabled) {
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
        const success = await deleteBlockedWebsite(url);
        if (success) {
            setSelectedWebsites(null);
            getWebsitesData();
            onClose();
        } else {
            showError();
        }
    };

    return (
        <>
            <BlurModal visible={visible} onClose={onClose}>
                <ThemedText align="center">
                    Are you sure you want to remove{' '}
                    <ThemedText color="primaryBlue" weight="strong" size="large">
                        {url}
                    </ThemedText>{' '}
                    from your block list?
                </ThemedText>
                <View style={styles.popupButtonsContainer}>
                    <ActionButton variant="cancel" onPress={onClose} />
                    <ActionButton variant="confirm" onPress={handleInitialConfirm} />
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
    showError: () => void;
}

const PopupHide: React.FC<PopupVisibleProps> = ({
    onClose,
    visible,
    url,
    setHideSelectedWebsite,
    getWebsitesData,
    showError,
}) => {
    const onConfirm = async () => {
        const success = await hideBlockedWebsite(url);
        if (success) {
            setHideSelectedWebsite(null);
            getWebsitesData();
            onClose();
        } else {
            showError();
        }
    };

    return (
        <BlurModal visible={visible} onClose={() => onClose}>
            <ThemedText weight="strong" size="large" align="center">
                Are you sure you want to make{' '}
                <ThemedText weight="strong" size="large" color="primaryBlue">
                    {url}
                </ThemedText>{' '}
                invisible?
            </ThemedText>
            <ThemedText weight="strong" color="primaryRed" align="center" style={{ marginTop: spacing.md }}>
                Once hidden, you won’t be able to remove it unless you clear the app’s data through your device
                settings!
            </ThemedText>
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
    innerRightContainer: {
        flexDirection: 'row',
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
        marginLeft: spacing.md,
        marginTop: spacing.xs,
    },
    favicon: {
        marginRight: spacing.sm,
    },
    scrollContainer: {
        paddingBottom: spacing.md,
    },
});

export default HomeScreen;
