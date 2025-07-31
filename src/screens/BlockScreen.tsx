import { StyleSheet, View, ActivityIndicator, Pressable } from 'react-native';
import BaseScreen from '../components/BaseScreen';
import React, { useState, useEffect, useCallback } from 'react';
import SearchBar from '../components/SearchBar';
import Icon from '../components/Icon';
import { useNavigation } from '@react-navigation/native';
import { RootStackNavigation } from '../types/types';
import NextButton from '../components/NextButton';
import ItemContainer from '../components/itemContainer';
import Favicon from '../components/Favicon';
import BlurModal from '../components/BlurModal';
import ActionButton from '../components/ActionButton';
import { denormalizeUrl, normalizeUrl } from '../utils/urlHelpers';
import { spacing } from '../theme/tokens';
import { ThemedText } from '../components/ThemedText';
import ErrorPopup from '../components/ErrorPopup';
import { isWebsiteBlocked } from '../utils/storage';
import { ERRORS } from '../constants/strings';

const BlockScreen: React.FC = () => {
    const [searchQuery, setSearchQuery] = useState('');
    const [websiteUrl, setWebsiteUrl] = useState<string>('');
    const [loading, setLoading] = useState(false);
    const [next, setNext] = useState(false);
    const [alreadyBlockedPopupVisible, setAlreadyBlockedPopupVisible] = useState(false);
    const [errorPopupVisible, setErrorPopupVisible] = useState(false);
    const [errorTitle, setErrorTitle] = useState('');
    const [errorText, setErrorText] = useState('');

    const navigation = useNavigation<RootStackNavigation>();

    const showError = (title: string, text: string) => {
        setErrorTitle(title);
        setErrorText(text);
        setErrorPopupVisible(true);
    };

    const handlePressNext = async () => {
        try {
            const alreadyBlocked = await isWebsiteBlocked(websiteUrl);

            if (alreadyBlocked) {
                setAlreadyBlockedPopupVisible(true);
                return;
            } else {
                navigation.navigate('Schedule', { websiteUrl: websiteUrl });
            }
        } catch {
            showError(ERRORS.dataLoadError.title, ERRORS.dataLoadError.text);
        }
    };

    const checkUrl = useCallback(async (url: string) => {
        if (!url || !url.includes('.')) {
            setWebsiteUrl('');
            setLoading(false);
            return;
        }

        setLoading(true);
        setWebsiteUrl('');
        const normalizedUrl = normalizeUrl(url);

        try {
            const response = await fetch(normalizedUrl);
            if (response.ok) {
                setWebsiteUrl(denormalizeUrl(normalizedUrl));
            } else {
                showError(ERRORS.invalidUrl.title, ERRORS.invalidUrl.text);
            }
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        const delayDebounce = setTimeout(() => {
            setLoading(true);
            setNext(false);
            checkUrl(searchQuery);
        }, 600);

        return () => clearTimeout(delayDebounce);
    }, [searchQuery, checkUrl]);

    return (
        <BaseScreen title="Add Site" showHeader={false}>
            <View style={{ marginTop: spacing.lg, marginHorizontal: spacing.sm }}>
                <SearchBar placeholder="Find website..." onSearch={setSearchQuery} />
            </View>
            {searchQuery.length === 0 ? (
                <GuideContainer />
            ) : loading ? (
                <ActivityIndicator size="large" color="#0000ff" />
            ) : websiteUrl.length > 0 ? (
                <View>
                    <Pressable onPress={() => setNext(prev => !prev)}>
                        <ItemContainer>
                            <View style={styles.websiteContainer}>
                                <Favicon url={websiteUrl} style={styles.favicon} />
                                <ThemedText weight="medium" size="large">
                                    {websiteUrl}
                                </ThemedText>
                            </View>
                            <View style={styles.plusIconContainer}>
                                {next ? (
                                    <Icon name="Selected" tint={false} size={35} />
                                ) : (
                                    <Icon name="Plus" size={20} opacity="faded" />
                                )}
                            </View>
                        </ItemContainer>
                    </Pressable>
                    {next && <NextButton onPress={handlePressNext} />}
                </View>
            ) : (
                <ThemedText style={styles.noResultsText}>No results found for "{searchQuery}"</ThemedText>
            )}
            <AlreadyBlockedPopup
                visible={alreadyBlockedPopupVisible}
                websiteUrl={websiteUrl}
                onClose={() => setAlreadyBlockedPopupVisible(false)}
            />
            <ErrorPopup
                title={errorTitle}
                text={errorText}
                visible={errorPopupVisible}
                onClose={() => setErrorPopupVisible(false)}
            />
        </BaseScreen>
    );
};

const GuideContainer = () => {
    return (
        <ItemContainer style={styles.guideContainer}>
            <ThemedText size="large" weight="medium">
                Guide
            </ThemedText>
            <View style={{ marginTop: spacing.sm }}>
                <ThemedText size="small">
                    1. Enter the domain name or URL without "https://" or "www". Instead of adding{' '}
                    <ThemedText weight="strong" color="primaryBlue" size="small">
                        https://www.facebook.com
                    </ThemedText>
                    , just type{' '}
                    <ThemedText weight="strong" color="primaryBlue" size="small">
                        facebook.com
                    </ThemedText>
                    .
                </ThemedText>
            </View>
            <View style={{ marginVertical: spacing.xs }}>
                <ThemedText size="small">
                    2. If you need a specific webpage or directory, type it directly. For example, enter{' '}
                    <ThemedText weight="strong" color="primaryBlue" size="small">
                        facebook.com/home
                    </ThemedText>{' '}
                    to access a particular section.
                </ThemedText>
            </View>
        </ItemContainer>
    );
};

interface AlreadyBlockedPopupProps {
    visible: boolean;
    websiteUrl: string;
    onClose: () => void;
}

const AlreadyBlockedPopup: React.FC<AlreadyBlockedPopupProps> = ({ visible, websiteUrl, onClose }) => {
    return (
        <BlurModal visible={visible} onClose={onClose}>
            <ThemedText align="center">
                <ThemedText color="primaryBlue" weight="strong">
                    {websiteUrl}
                </ThemedText>{' '}
                is already blocked. No need to add it again!
            </ThemedText>
            <ActionButton variant="cancel" onPress={onClose} style={styles.cancelActionButton} />
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
    guideContainer: {
        flexDirection: 'column',
        alignItems: 'flex-start',
    },
    favicon: {
        marginRight: spacing.sm,
    },
    noResultsText: {
        marginHorizontal: spacing.md,
        marginVertical: spacing.sm,
    },
    cancelActionButton: {
        marginTop: spacing.lg,
    },
});

export default BlockScreen;
