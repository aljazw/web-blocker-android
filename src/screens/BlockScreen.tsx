import { ActivityIndicator, FlatList, StyleSheet, View, Pressable, ScrollView } from 'react-native';
import BaseScreen from '../components/BaseScreen';
import React, { useState, useEffect, useCallback } from 'react';
import SearchBar from '../components/SearchBar';
import Icon from '../components/Icon';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { RootStackNavigation } from '../types/types';
import ItemContainer from '../components/ItemContainer';
import Favicon from '../components/Favicon';
import BlurModal from '../components/BlurModal';
import Button from '../components/Button';
import Chip from '../components/Chip';
import SectionHeader from '../components/SectionHeader';
import { toBlockableUrl } from '../utils/urlHelpers';
import { shapes, spacing } from '../theme/tokens';
import { ThemedText } from '../components/ThemedText';
import { ThemedView } from '../components/ThemedView';
import ErrorPopup from '../components/ErrorPopup';
import { getBlockedWebsites, isWebsiteBlocked } from '../utils/storage';
import { useTheme } from '../context/ThemeContext';
import { ERRORS } from '../constants/strings';
import { SITE_SUGGESTIONS } from '../constants/suggestions';
import { FadeIn, stagger } from '../components/Motion';
import Segmented from '../components/Segmented';
import AppIcon from '../components/AppIcon';
import { getBlockedApps } from '../utils/storage';
import { getLaunchableApps, InstalledApp } from '../utils/installedApps';

const BlockScreen: React.FC = () => {
    const { theme } = useTheme();
    const [searchQuery, setSearchQuery] = useState('');
    const [websiteUrl, setWebsiteUrl] = useState<string>('');
    const [mode, setMode] = useState<'sites' | 'apps'>('sites');
    const [blocked, setBlocked] = useState<Set<string>>(new Set());
    const [blockedApps, setBlockedApps] = useState<Set<string>>(new Set());
    const [alreadyBlockedUrl, setAlreadyBlockedUrl] = useState<string | null>(null);
    const [errorPopupVisible, setErrorPopupVisible] = useState(false);
    const [errorTitle, setErrorTitle] = useState('');
    const [errorText, setErrorText] = useState('');

    const navigation = useNavigation<RootStackNavigation>();

    const showError = (title: string, text: string) => {
        setErrorTitle(title);
        setErrorText(text);
        setErrorPopupVisible(true);
    };

    // Know which suggestions are already on the list each time the tab opens.
    useFocusEffect(
        useCallback(() => {
            getBlockedWebsites()
                .then(list => setBlocked(new Set(list.map(w => w.websiteUrl))))
                .catch(() => setBlocked(new Set()));
            getBlockedApps()
                .then(list => setBlockedApps(new Set(list.map(a => a.packageName))))
                .catch(() => setBlockedApps(new Set()));
        }, []),
    );

    const goToAppSchedule = (app: InstalledApp) => {
        if (blockedApps.has(app.packageName)) {
            setAlreadyBlockedUrl(app.label);
            return;
        }
        navigation.navigate('Schedule', { app: { packageName: app.packageName, appName: app.label } });
    };

    const goToSchedule = async (url: string) => {
        try {
            if (await isWebsiteBlocked(url)) {
                setAlreadyBlockedUrl(url);
                return;
            }
            navigation.navigate('Schedule', { websiteUrl: url });
        } catch {
            showError(ERRORS.dataLoadError.title, ERRORS.dataLoadError.text);
        }
    };

    // Validated locally: instant, offline, and never blocks you from adding a
    // site that happens to be unreachable.
    const checkUrl = useCallback((input: string) => setWebsiteUrl(toBlockableUrl(input) ?? ''), []);

    useEffect(() => {
        const delayDebounce = setTimeout(() => {
            checkUrl(searchQuery);
        }, 300);

        return () => clearTimeout(delayDebounce);
    }, [searchQuery, checkUrl]);

    return (
        <BaseScreen
            title="Add a block"
            subtitle={mode === 'sites' ? 'Type an address or pick a common distraction' : 'Pick an app to block'}>
            <Segmented
                options={[
                    { value: 'sites', label: 'Websites' },
                    { value: 'apps', label: 'Apps' },
                ]}
                value={mode}
                onChange={setMode}
                style={styles.modeSwitch}
            />
            {mode === 'apps' ? (
                <AppPicker blocked={blockedApps} onPick={goToAppSchedule} />
            ) : (
                <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
                    <View style={styles.search}>
                        <SearchBar placeholder="e.g. youtube.com" onSearch={setSearchQuery} />
                    </View>

                    {searchQuery.length > 0 &&
                        (websiteUrl.length > 0 ? (
                            <FadeIn key={websiteUrl} offset={8}>
                                <Pressable onPress={() => goToSchedule(websiteUrl)}>
                                    {({ pressed }) => (
                                        <ItemContainer
                                            style={[
                                                styles.result,
                                                { borderColor: theme.colors.accent },
                                                pressed && styles.pressed,
                                            ]}>
                                            <View
                                                style={[
                                                    styles.faviconWrap,
                                                    { backgroundColor: theme.colors.elevated },
                                                ]}>
                                                <Favicon url={websiteUrl} size={22} />
                                            </View>
                                            <View style={styles.flex}>
                                                <ThemedText weight="strong" numberOfLines={1}>
                                                    {websiteUrl}
                                                </ThemedText>
                                                <ThemedText size="small" color="muted">
                                                    {blocked.has(websiteUrl)
                                                        ? 'Already on your list'
                                                        : 'Tap to set a schedule'}
                                                </ThemedText>
                                            </View>
                                            <View style={[styles.addBadge, { backgroundColor: theme.colors.accent }]}>
                                                <Icon name="Plus" size={14} tint={theme.colors.onAccent} />
                                            </View>
                                        </ItemContainer>
                                    )}
                                </Pressable>
                            </FadeIn>
                        ) : (
                            <ThemedText size="small" color="muted" style={styles.hint}>
                                Enter a valid address like{' '}
                                <ThemedText size="small" weight="strong" color="accent">
                                    facebook.com
                                </ThemedText>{' '}
                                to block it.
                            </ThemedText>
                        ))}

                    {SITE_SUGGESTIONS.map((group, index) => (
                        <FadeIn key={group.category} delay={stagger(index, 70)}>
                            <SectionHeader title={group.category} />
                            <View style={styles.chips}>
                                {group.sites.map(site => {
                                    const isBlocked = blocked.has(site);
                                    return (
                                        <Chip
                                            key={site}
                                            label={isBlocked ? `✓ ${site}` : site}
                                            selected={isBlocked}
                                            disabled={isBlocked}
                                            onPress={() => goToSchedule(site)}
                                        />
                                    );
                                })}
                            </View>
                        </FadeIn>
                    ))}

                    <FadeIn delay={stagger(SITE_SUGGESTIONS.length, 70)}>
                        <SectionHeader title="Tips" />
                        <ThemedView withBorder style={styles.tips}>
                            <Tip
                                n={1}
                                text="Type just the domain — facebook.com instead of https://www.facebook.com."
                            />
                            <Tip n={2} text="To block only one section, include the path, like facebook.com/watch." />
                            <Tip n={3} text="After adding, choose the days and hours the block should apply." />
                        </ThemedView>
                    </FadeIn>
                </ScrollView>
            )}

            <AlreadyBlockedPopup
                visible={!!alreadyBlockedUrl}
                websiteUrl={alreadyBlockedUrl ?? ''}
                onClose={() => setAlreadyBlockedUrl(null)}
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

interface AppPickerProps {
    blocked: Set<string>;
    onPick: (app: InstalledApp) => void;
}

/** Searchable list of the apps installed on the phone. */
const AppPicker: React.FC<AppPickerProps> = ({ blocked, onPick }) => {
    const { theme } = useTheme();
    const [apps, setApps] = useState<InstalledApp[] | null>(null);
    const [query, setQuery] = useState('');

    useEffect(() => {
        getLaunchableApps().then(setApps);
    }, []);

    const q = query.trim().toLowerCase();
    const filtered = (apps ?? []).filter(
        app => !q || app.label.toLowerCase().includes(q) || app.packageName.toLowerCase().includes(q),
    );

    return (
        <View style={styles.flex}>
            <View style={styles.search}>
                <SearchBar placeholder="Search apps" keyboardType="default" onSearch={setQuery} />
            </View>
            {apps === null ? (
                <ActivityIndicator color={theme.colors.accent} style={styles.loading} />
            ) : (
                <FlatList
                    data={filtered}
                    keyExtractor={app => app.packageName}
                    keyboardShouldPersistTaps="handled"
                    contentContainerStyle={styles.scroll}
                    initialNumToRender={14}
                    ListEmptyComponent={
                        <ThemedText size="small" color="muted" align="center" style={styles.loading}>
                            {q ? `No apps match “${query}”` : 'No apps found'}
                        </ThemedText>
                    }
                    renderItem={({ item }) => {
                        const isBlocked = blocked.has(item.packageName);
                        return (
                            <Pressable onPress={() => onPick(item)}>
                                {({ pressed }) => (
                                    <ItemContainer style={pressed && styles.pressed}>
                                        <AppIcon packageName={item.packageName} size={36} style={styles.appIcon} />
                                        <View style={styles.flex}>
                                            <ThemedText weight="strong" numberOfLines={1}>
                                                {item.label}
                                            </ThemedText>
                                            <ThemedText size="tiny" color="muted" numberOfLines={1}>
                                                {item.packageName}
                                            </ThemedText>
                                        </View>
                                        {isBlocked ? (
                                            <ThemedText size="small" weight="strong" color="accent">
                                                Blocked
                                            </ThemedText>
                                        ) : (
                                            <View
                                                style={[styles.addBadge, { backgroundColor: theme.colors.accentSoft }]}>
                                                <Icon name="Plus" size={14} tint={theme.colors.accent} />
                                            </View>
                                        )}
                                    </ItemContainer>
                                )}
                            </Pressable>
                        );
                    }}
                />
            )}
        </View>
    );
};

const Tip: React.FC<{ n: number; text: string }> = ({ n, text }) => {
    const { theme } = useTheme();
    return (
        <View style={styles.tipRow}>
            <View style={[styles.tipNumber, { backgroundColor: theme.colors.accentSoft }]}>
                <ThemedText size="tiny" weight="strong" color="accent">
                    {n}
                </ThemedText>
            </View>
            <ThemedText size="small" color="muted" style={styles.flex}>
                {text}
            </ThemedText>
        </View>
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
            <ThemedText size="large" weight="strong" align="center" style={styles.popupTitle}>
                Already blocked
            </ThemedText>
            <ThemedText align="center" color="muted">
                <ThemedText color="accent" weight="strong">
                    {websiteUrl}
                </ThemedText>{' '}
                is already on your block list. No need to add it again!
            </ThemedText>
            <Button label="Got it" compact onPress={onClose} style={styles.popupButton} />
        </BlurModal>
    );
};

const styles = StyleSheet.create({
    scroll: {
        paddingBottom: spacing.xl,
    },
    modeSwitch: {
        marginHorizontal: spacing.md,
        marginTop: spacing.xs,
        marginBottom: spacing.sm,
    },
    loading: {
        marginTop: spacing.xl,
    },
    appIcon: {
        marginRight: spacing.sm + 2,
    },
    search: {
        marginHorizontal: spacing.md,
        marginTop: spacing.xs,
    },
    result: {
        marginTop: spacing.md,
        borderWidth: 1.5,
    },
    pressed: {
        opacity: 0.85,
    },
    faviconWrap: {
        width: 40,
        height: 40,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: spacing.sm + 2,
    },
    flex: {
        flex: 1,
    },
    addBadge: {
        width: 30,
        height: 30,
        borderRadius: 15,
        alignItems: 'center',
        justifyContent: 'center',
    },
    hint: {
        marginHorizontal: spacing.md + 4,
        marginTop: spacing.md,
    },
    chips: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginHorizontal: spacing.md,
        marginTop: spacing.xs,
    },
    tips: {
        marginHorizontal: spacing.md,
        padding: spacing.md,
        borderRadius: shapes.borderRadius.medium,
    },
    tipRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginVertical: 5,
    },
    tipNumber: {
        width: 22,
        height: 22,
        borderRadius: 11,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: spacing.sm,
    },
    popupTitle: {
        marginBottom: spacing.sm,
    },
    popupButton: {
        marginTop: spacing.lg,
        alignSelf: 'stretch',
    },
});

export default BlockScreen;
