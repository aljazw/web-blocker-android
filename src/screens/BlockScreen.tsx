import { ActivityIndicator, FlatList, StyleSheet, View, Pressable, ScrollView } from 'react-native';
import BaseScreen from '../components/BaseScreen';
import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import SearchBar from '../components/SearchBar';
import Icon from '../components/Icon';
import { useNavigation } from '@react-navigation/native';
import { RootStackNavigation } from '../types/types';
import ItemContainer from '../components/ItemContainer';
import Favicon from '../components/Favicon';
import Dialog from '../components/Dialog';
import IconTile from '../components/IconTile';
import Chip from '../components/Chip';
import ChipGroup from '../components/ChipGroup';
import SectionHeader from '../components/SectionHeader';
import { toBlockableUrl } from '../utils/urlHelpers';
import { gutter, shapes, spacing } from '../theme/tokens';
import { ThemedText } from '../components/ThemedText';
import { ThemedView } from '../components/ThemedView';
import ErrorPopup from '../components/ErrorPopup';
import { useTheme } from '../context/ThemeContext';
import { ERRORS } from '../constants/strings';
import { SITE_SUGGESTIONS } from '../constants/suggestions';
import { FadeIn, stagger } from '../components/Motion';
import Segmented from '../components/Segmented';
import AppIcon from '../components/AppIcon';
import Badge from '../components/Badge';
import { useBlockList } from '../hooks/useBlockList';
import { getLaunchableApps, InstalledApp } from '../utils/installedApps';

const BlockScreen: React.FC = () => {
    const { theme } = useTheme();
    const [searchQuery, setSearchQuery] = useState('');
    const [websiteUrl, setWebsiteUrl] = useState<string>('');
    const [mode, setMode] = useState<'sites' | 'apps'>('sites');
    const [alreadyBlockedUrl, setAlreadyBlockedUrl] = useState<string | null>(null);
    const navigation = useNavigation<RootStackNavigation>();

    // Which suggestions and apps are already on the list.
    const { entries, loadFailed } = useBlockList();
    const blocked = useMemo(() => new Set(entries.filter(e => e.kind === 'site').map(e => e.key)), [entries]);
    const blockedApps = useMemo(() => new Set(entries.filter(e => e.kind === 'app').map(e => e.key)), [entries]);
    const [dismissedError, setDismissedError] = useState(false);

    const goToAppSchedule = useCallback(
        (app: InstalledApp) => {
            if (blockedApps.has(app.packageName)) {
                setAlreadyBlockedUrl(app.label);
                return;
            }
            navigation.navigate('Schedule', { app: { packageName: app.packageName, appName: app.label } });
        },
        [blockedApps, navigation],
    );

    const goToSchedule = (url: string) => {
        if (blocked.has(url)) {
            setAlreadyBlockedUrl(url);
            return;
        }
        navigation.navigate('Schedule', { websiteUrl: url });
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
                                                pressed && { backgroundColor: theme.colors.elevated },
                                            ]}>
                                            <IconTile size={36} style={styles.leading}>
                                                <Favicon url={websiteUrl} size={20} />
                                            </IconTile>
                                            <View style={styles.flex}>
                                                <ThemedText weight="medium" numberOfLines={1}>
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
                                <ThemedText size="small" weight="medium" color="text">
                                    facebook.com
                                </ThemedText>{' '}
                                to block it.
                            </ThemedText>
                        ))}

                    {SITE_SUGGESTIONS.map((group, index) => (
                        <FadeIn key={group.category} delay={stagger(index, 70)}>
                            <SectionHeader title={group.category} />
                            <ChipGroup>
                                {group.sites.map(site => {
                                    const isBlocked = blocked.has(site);
                                    return (
                                        <Chip
                                            key={site}
                                            icon={isBlocked ? 'Check' : undefined}
                                            label={site}
                                            selected={isBlocked}
                                            disabled={isBlocked}
                                            onPress={() => goToSchedule(site)}
                                        />
                                    );
                                })}
                            </ChipGroup>
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

            <Dialog
                visible={!!alreadyBlockedUrl}
                onClose={() => setAlreadyBlockedUrl(null)}
                icon="Check"
                title="Already blocked"
                message={`${alreadyBlockedUrl ?? ''} is already on your block list.`}
            />
            <ErrorPopup
                {...ERRORS.dataLoadError}
                visible={loadFailed && !dismissedError}
                onClose={() => setDismissedError(true)}
            />
        </BaseScreen>
    );
};

interface AppPickerProps {
    blocked: Set<string>;
    onPick: (app: InstalledApp) => void;
}

/** ItemContainer: 10 margin + 2 × 14 padding + 36 icon + 2 border. Fixed so the list can skip measuring. */
const APP_ROW_HEIGHT = 76;

/** Searchable list of the apps installed on the phone. */
const AppPicker: React.FC<AppPickerProps> = ({ blocked, onPick }) => {
    const { theme } = useTheme();
    const [apps, setApps] = useState<InstalledApp[] | null>(null);
    const [query, setQuery] = useState('');

    useEffect(() => {
        let alive = true;
        getLaunchableApps().then(list => alive && setApps(list));
        return () => {
            alive = false;
        };
    }, []);

    const q = query.trim().toLowerCase();
    const filtered = useMemo(
        () =>
            (apps ?? []).filter(
                app => !q || app.label.toLowerCase().includes(q) || app.packageName.toLowerCase().includes(q),
            ),
        [apps, q],
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
                    initialNumToRender={12}
                    maxToRenderPerBatch={10}
                    windowSize={7}
                    removeClippedSubviews
                    getItemLayout={(_, index) => ({ length: APP_ROW_HEIGHT, offset: APP_ROW_HEIGHT * index, index })}
                    ListEmptyComponent={
                        <ThemedText size="small" color="muted" align="center" style={styles.loading}>
                            {q ? `No apps match “${query}”` : 'No apps found'}
                        </ThemedText>
                    }
                    renderItem={({ item }) => (
                        <AppRow app={item} blocked={blocked.has(item.packageName)} onPick={onPick} />
                    )}
                />
            )}
        </View>
    );
};

const AppRow = memo(
    ({ app, blocked, onPick }: { app: InstalledApp; blocked: boolean; onPick: (app: InstalledApp) => void }) => {
        const { theme } = useTheme();
        return (
            <Pressable onPress={() => onPick(app)} style={styles.appRow}>
                {({ pressed }) => (
                    <ItemContainer style={pressed && { backgroundColor: theme.colors.elevated }}>
                        <AppIcon packageName={app.packageName} size={36} style={styles.appIcon} />
                        <View style={styles.flex}>
                            <ThemedText weight="medium" numberOfLines={1}>
                                {app.label}
                            </ThemedText>
                            <ThemedText size="tiny" color="muted" numberOfLines={1}>
                                {app.packageName}
                            </ThemedText>
                        </View>
                        {blocked ? (
                            <Badge label="Blocked" tone="accent" />
                        ) : (
                            <View style={[styles.addBadge, { backgroundColor: theme.colors.accentSoft }]}>
                                <Icon name="Plus" size={14} tint={theme.colors.accent} />
                            </View>
                        )}
                    </ItemContainer>
                )}
            </Pressable>
        );
    },
);

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

const styles = StyleSheet.create({
    scroll: {
        paddingBottom: spacing.xl,
    },
    modeSwitch: {
        marginHorizontal: gutter,
        marginTop: spacing.xs,
        marginBottom: spacing.sm,
    },
    loading: {
        marginTop: spacing.xl,
    },
    appRow: {
        height: APP_ROW_HEIGHT,
        overflow: 'hidden',
    },
    appIcon: {
        marginRight: spacing.sm + 2,
    },
    search: {
        marginHorizontal: gutter,
        marginTop: spacing.xs,
    },
    result: {
        marginTop: spacing.md,
        borderWidth: 1.5,
    },
    flex: {
        flex: 1,
    },
    leading: {
        marginRight: spacing.sm + 2,
    },
    addBadge: {
        width: 28,
        height: 28,
        borderRadius: shapes.borderRadius.small + 2,
        alignItems: 'center',
        justifyContent: 'center',
    },
    hint: {
        marginHorizontal: spacing.md + 4,
        marginTop: spacing.md,
    },
    tips: {
        marginHorizontal: gutter,
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
        borderRadius: shapes.borderRadius.small,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: spacing.sm,
    },
});

export default BlockScreen;
