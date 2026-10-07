import { Pressable, StyleSheet, View, ScrollView } from 'react-native';
import BaseScreen from '../components/BaseScreen';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { BlockedWebsitesData, RootStackNavigation } from '../types/types';
import ItemContainer from '../components/itemContainer';
import Favicon from '../components/Favicon';
import Icon from '../components/Icon';
import ActionButton from '../components/ActionButton';
import BlurModal from '../components/BlurModal';
import Button from '../components/Button';
import SearchBar from '../components/SearchBar';
import SectionHeader from '../components/SectionHeader';
import { shapes, spacing } from '../theme';
import { ThemedText } from '../components/ThemedText';
import { ThemedView } from '../components/ThemedView';
import PassphrasePopup from '../components/PassphrasePopup';
import { usePassphrase } from '../context/PassphraseContext';
import { useTheme } from '../context/ThemeContext';
import ErrorPopup from '../components/ErrorPopup';
import { deleteBlockedWebsite, getBlockedWebsites, hideBlockedWebsite } from '../utils/storage';
import { checkAccessibilityEnabled, openAccessibilitySettings } from '../utils/accessibility';
import { describeDays, describeTime, isBlockActiveNow } from '../utils/schedule';
import { ERRORS } from '../constants/strings';
import { AnimatedNumber, FadeIn, animateLayout, stagger } from '../components/Motion';
import { haptics } from '../utils/haptics';

const greeting = (date: Date) => {
    const h = date.getHours();
    if (h < 5) return 'Late night focus';
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
};

const HomeScreen: React.FC = () => {
    const { theme } = useTheme();
    const navigation = useNavigation<RootStackNavigation>();

    const [websites, setWebsites] = useState<BlockedWebsitesData[]>([]);
    const [protectionOn, setProtectionOn] = useState<boolean | null>(null);
    const [now, setNow] = useState(new Date());
    const [query, setQuery] = useState('');
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

    // Reload whenever the tab comes into view, so newly added sites show up immediately.
    useFocusEffect(
        useCallback(() => {
            getWebsitesData();
            checkAccessibilityEnabled().then(setProtectionOn);
            setNow(new Date());
        }, [getWebsitesData]),
    );

    // Keep "Active now" badges fresh while the screen is open.
    useEffect(() => {
        const id = setInterval(() => setNow(new Date()), 60_000);
        return () => clearInterval(id);
    }, []);

    const visibleSites = useMemo(() => websites.filter(w => w.visible), [websites]);
    const hiddenCount = websites.length - visibleSites.length;
    const activeCount = useMemo(() => websites.filter(w => isBlockActiveNow(w, now)).length, [websites, now]);
    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        return q ? visibleSites.filter(w => w.websiteUrl.toLowerCase().includes(q)) : visibleSites;
    }, [visibleSites, query]);

    const goToAddSite = () => navigation.navigate('BottomTabs', { screen: 'Block' });

    return (
        <BaseScreen title={greeting(now)} subtitle="Here’s what SiteLock is guarding today">
            <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
                {/* ---- Hero status card ---- */}
                <FadeIn>
                    <View
                        style={[
                            styles.hero,
                            {
                                backgroundColor: protectionOn === false ? theme.colors.primaryRed : theme.colors.accent,
                            },
                        ]}>
                        <View style={styles.heroTop}>
                            <View style={styles.heroBadge}>
                                <View style={[styles.dot, { backgroundColor: '#FFFFFF' }]} />
                                <ThemedText size="tiny" weight="strong" style={styles.onHero}>
                                    {protectionOn === false ? 'PROTECTION OFF' : 'PROTECTION ON'}
                                </ThemedText>
                            </View>
                            <Icon
                                name={protectionOn === false ? 'ShieldOff' : 'Shield'}
                                size={26}
                                tint="rgba(255,255,255,0.9)"
                            />
                        </View>
                        <AnimatedNumber value={activeCount} size="display" weight="strong" style={styles.onHero} />
                        <ThemedText weight="medium" style={styles.onHeroMuted}>
                            {activeCount === 1 ? 'site blocked right now' : 'sites blocked right now'}
                        </ThemedText>
                        {protectionOn === false && (
                            <Pressable onPress={openAccessibilitySettings} style={styles.heroAction}>
                                <ThemedText size="small" weight="strong" style={{ color: theme.colors.primaryRed }}>
                                    Turn protection back on
                                </ThemedText>
                            </Pressable>
                        )}
                    </View>
                </FadeIn>

                {/* ---- Quick stats ---- */}
                <FadeIn delay={80} style={styles.statsRow}>
                    <StatTile label="On your list" value={websites.length} />
                    <StatTile label="Paused now" value={websites.length - activeCount} />
                    <StatTile label="Hidden" value={hiddenCount} />
                </FadeIn>

                {/* ---- Block list ---- */}
                <SectionHeader
                    title="Your block list"
                    right={
                        visibleSites.length > 0 ? (
                            <Pressable onPress={goToAddSite} hitSlop={8}>
                                <ThemedText size="small" weight="strong" color="accent">
                                    + Add
                                </ThemedText>
                            </Pressable>
                        ) : undefined
                    }
                />

                {visibleSites.length === 0 ? (
                    <FadeIn delay={140}>
                        <ThemedView withBorder style={styles.empty}>
                            <View style={[styles.emptyIcon, { backgroundColor: theme.colors.accentSoft }]}>
                                <Icon name="Shield" size={28} tint={theme.colors.accent} />
                            </View>
                            <ThemedText size="large" weight="strong" align="center">
                                Nothing blocked yet
                            </ThemedText>
                            <ThemedText size="small" color="muted" align="center" style={styles.emptyText}>
                                Add the sites that steal your time. You can block them all day or only during the hours
                                you choose.
                            </ThemedText>
                            <Button label="Block your first site" icon="ArrowRight" onPress={goToAddSite} />
                        </ThemedView>
                    </FadeIn>
                ) : (
                    <>
                        {visibleSites.length > 3 && (
                            <View style={styles.search}>
                                <SearchBar
                                    placeholder="Search your list"
                                    keyboardType="default"
                                    onSearch={q => {
                                        animateLayout();
                                        setQuery(q);
                                    }}
                                />
                            </View>
                        )}
                        {filtered.map((website, index) => {
                            const active = isBlockActiveNow(website, now);
                            return (
                                <FadeIn key={website.websiteUrl} delay={140 + stagger(index)}>
                                    <ItemContainer>
                                        <View style={[styles.faviconWrap, { backgroundColor: theme.colors.elevated }]}>
                                            <Favicon url={website.websiteUrl} size={22} />
                                        </View>
                                        <View style={styles.siteInfo}>
                                            <ThemedText weight="strong" numberOfLines={1}>
                                                {website.websiteUrl}
                                            </ThemedText>
                                            <View style={styles.metaRow}>
                                                <View
                                                    style={[
                                                        styles.dot,
                                                        {
                                                            backgroundColor: active
                                                                ? theme.colors.primaryGreen
                                                                : theme.colors.muted,
                                                        },
                                                    ]}
                                                />
                                                <ThemedText size="small" color="muted" numberOfLines={1}>
                                                    {active ? 'Blocked now' : 'Paused'} · {describeDays(website.days)} ·{' '}
                                                    {describeTime(website.time)}
                                                </ThemedText>
                                            </View>
                                        </View>
                                        <IconButton
                                            icon="Hide"
                                            onPress={() => setHideSelectedWebsite(website.websiteUrl)}
                                        />
                                        <IconButton
                                            icon="Trash"
                                            onPress={() => setRemoveSelectedWebsite(website.websiteUrl)}
                                        />
                                    </ItemContainer>
                                </FadeIn>
                            );
                        })}
                        {filtered.length === 0 && (
                            <ThemedText color="muted" align="center" style={styles.noMatches}>
                                No sites match “{query}”
                            </ThemedText>
                        )}
                    </>
                )}
            </ScrollView>

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
                onClose={() => setErrorPopupVisible(false)}
            />
        </BaseScreen>
    );
};

const StatTile: React.FC<{ label: string; value: number }> = ({ label, value }) => (
    <ThemedView withBorder style={styles.statTile}>
        <AnimatedNumber value={value} size="xlarge" weight="strong" />
        <ThemedText size="tiny" color="muted" weight="medium">
            {label}
        </ThemedText>
    </ThemedView>
);

const IconButton: React.FC<{ icon: string; onPress: () => void }> = ({ icon, onPress }) => {
    const { theme } = useTheme();
    return (
        <Pressable
            onPress={onPress}
            hitSlop={6}
            style={({ pressed }) => [styles.iconButton, pressed && { backgroundColor: theme.colors.elevated }]}>
            <Icon name={icon} size={18} tint={theme.colors.muted} />
        </Pressable>
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
            haptics.success();
            animateLayout();
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
                <ThemedText size="large" weight="strong" align="center" style={styles.popupTitle}>
                    Remove this site?
                </ThemedText>
                <ThemedText align="center" color="muted">
                    <ThemedText color="accent" weight="strong">
                        {url}
                    </ThemedText>{' '}
                    will no longer be blocked.
                </ThemedText>
                <View style={styles.popupButtonsContainer}>
                    <ActionButton variant="cancel" onPress={onClose} />
                    <ActionButton variant="confirm" label="Remove" onPress={handleInitialConfirm} />
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
            haptics.success();
            animateLayout();
            setHideSelectedWebsite(null);
            getWebsitesData();
            onClose();
        } else {
            showError();
        }
    };

    return (
        <BlurModal visible={visible} onClose={onClose}>
            <ThemedText size="large" weight="strong" align="center" style={styles.popupTitle}>
                Hide{' '}
                <ThemedText size="large" weight="strong" color="accent">
                    {url}
                </ThemedText>
                ?
            </ThemedText>
            <ThemedText color="muted" align="center">
                It stays blocked but disappears from this list.
            </ThemedText>
            <ThemedText size="small" weight="strong" color="primaryRed" align="center" style={styles.warning}>
                Once hidden, you won’t be able to remove it unless you clear the app’s data through your device
                settings!
            </ThemedText>
            <View style={styles.popupButtonsContainer}>
                <ActionButton variant="cancel" onPress={onClose} />
                <ActionButton variant="confirm" label="Hide" onPress={onConfirm} />
            </View>
        </BlurModal>
    );
};

const styles = StyleSheet.create({
    scrollContainer: {
        paddingBottom: spacing.xl,
    },
    hero: {
        marginHorizontal: spacing.md,
        marginTop: spacing.sm,
        padding: spacing.lg,
        borderRadius: shapes.borderRadius.large,
    },
    heroTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.md,
    },
    heroBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.2)',
        paddingHorizontal: spacing.sm,
        paddingVertical: 5,
        borderRadius: shapes.borderRadius.pill,
    },
    onHero: {
        color: '#FFFFFF',
        letterSpacing: 0.6,
    },
    onHeroMuted: {
        color: 'rgba(255,255,255,0.85)',
    },
    heroAction: {
        alignSelf: 'flex-start',
        backgroundColor: '#FFFFFF',
        borderRadius: shapes.borderRadius.pill,
        paddingHorizontal: spacing.md,
        paddingVertical: 8,
        marginTop: spacing.md,
    },
    dot: {
        width: 7,
        height: 7,
        borderRadius: 4,
        marginRight: 6,
    },
    statsRow: {
        flexDirection: 'row',
        marginHorizontal: spacing.md - 4,
        marginTop: spacing.sm,
    },
    statTile: {
        flex: 1,
        marginHorizontal: 4,
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.md,
        borderRadius: shapes.borderRadius.medium,
    },
    search: {
        marginHorizontal: spacing.md,
        marginBottom: spacing.xs,
    },
    faviconWrap: {
        width: 40,
        height: 40,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: spacing.sm + 2,
    },
    siteInfo: {
        flex: 1,
        marginRight: spacing.xs,
    },
    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 3,
    },
    iconButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
    },
    empty: {
        marginHorizontal: spacing.md,
        padding: spacing.lg,
        borderRadius: shapes.borderRadius.large,
        alignItems: 'center',
    },
    emptyIcon: {
        width: 60,
        height: 60,
        borderRadius: 30,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: spacing.md,
    },
    emptyText: {
        marginTop: spacing.xs,
        marginBottom: spacing.lg,
    },
    noMatches: {
        marginTop: spacing.lg,
    },
    popupTitle: {
        marginBottom: spacing.sm,
    },
    warning: {
        marginTop: spacing.md,
    },
    popupButtonsContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginTop: spacing.lg,
    },
});

export default HomeScreen;
