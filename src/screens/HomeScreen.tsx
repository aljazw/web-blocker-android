import { Pressable, StyleSheet, View, ScrollView } from 'react-native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { BlockEntry, RootStackNavigation } from '../types/types';
import BaseScreen from '../components/BaseScreen';
import ItemContainer from '../components/ItemContainer';
import Favicon from '../components/Favicon';
import AppIcon from '../components/AppIcon';
import Icon from '../components/Icon';
import ActionButton from '../components/ActionButton';
import BlurModal from '../components/BlurModal';
import Button from '../components/Button';
import SearchBar from '../components/SearchBar';
import SectionHeader from '../components/SectionHeader';
import StatTile from '../components/StatTile';
import PassphrasePopup from '../components/PassphrasePopup';
import ErrorPopup from '../components/ErrorPopup';
import { ThemedText } from '../components/ThemedText';
import { ThemedView } from '../components/ThemedView';
import { AnimatedNumber, FadeIn, animateLayout, stagger } from '../components/Motion';
import { usePassphrase } from '../context/PassphraseContext';
import { useTheme } from '../context/ThemeContext';
import { useBlockList } from '../hooks/useBlockList';
import { useAppForeground } from '../hooks/useAppForeground';
import { shapes, spacing } from '../theme';
import { checkAccessibilityEnabled, openAccessibilitySettings } from '../utils/accessibility';
import { describeSchedule, isBlockActiveNow } from '../utils/schedule';
import { haptics } from '../utils/haptics';
import { ERRORS } from '../constants/strings';

/** One popup at a time. */
type Dialog =
    | { kind: 'remove'; entry: BlockEntry }
    | { kind: 'hide'; entry: BlockEntry }
    | { kind: 'passphrase'; entry: BlockEntry }
    | { kind: 'error'; title: string; text: string };

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

    const { isPassphraseEnabled } = usePassphrase();
    const { entries, loadFailed, remove, hide } = useBlockList();
    const [protectionOn, setProtectionOn] = useState<boolean | null>(null);
    const [now, setNow] = useState(new Date());
    const [query, setQuery] = useState('');
    const [dialog, setDialog] = useState<Dialog | null>(null);

    const close = () => setDialog(null);

    const refreshProtection = useCallback(() => {
        checkAccessibilityEnabled().then(setProtectionOn);
        setNow(new Date());
    }, []);
    useFocusEffect(refreshProtection);
    // Coming back from Accessibility settings should update the hero card at once.
    useAppForeground(refreshProtection);

    useEffect(() => {
        if (loadFailed) setDialog({ kind: 'error', ...ERRORS.dataLoadError });
    }, [loadFailed]);

    /** Runs a list change and reports failure in the error popup. */
    const apply = async (change: (entry: BlockEntry) => Promise<boolean>, entry: BlockEntry) => {
        animateLayout();
        if (await change(entry)) {
            haptics.success();
            close();
        } else {
            setDialog({ kind: 'error', ...ERRORS.saveFailed });
        }
    };

    const confirmRemove = (entry: BlockEntry) =>
        isPassphraseEnabled ? setDialog({ kind: 'passphrase', entry }) : apply(remove, entry);

    // Keep "Active now" badges fresh while the screen is open.
    useEffect(() => {
        const id = setInterval(() => setNow(new Date()), 60_000);
        return () => clearInterval(id);
    }, []);

    const visibleSites = useMemo(() => entries.filter(w => w.visible), [entries]);
    const hiddenCount = entries.length - visibleSites.length;
    const activeCount = useMemo(() => entries.filter(w => isBlockActiveNow(w, now)).length, [entries, now]);
    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        return q ? visibleSites.filter(w => w.label.toLowerCase().includes(q)) : visibleSites;
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
                                    {protectionOn === null
                                        ? 'CHECKING…'
                                        : protectionOn
                                        ? 'PROTECTION ON'
                                        : 'PROTECTION OFF'}
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
                            {activeCount === 1 ? 'block active right now' : 'blocks active right now'}
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
                    <StatTile label="On your list" value={entries.length} />
                    <StatTile label="Paused now" value={entries.length - activeCount} />
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
                                Add the sites and apps that steal your time. Block them all day or only during the hours
                                you choose.
                            </ThemedText>
                            <Button label="Add your first block" icon="ArrowRight" onPress={goToAddSite} />
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
                                <FadeIn key={`${website.kind}:${website.key}`} delay={140 + stagger(index)}>
                                    <ItemContainer>
                                        <View style={[styles.faviconWrap, { backgroundColor: theme.colors.elevated }]}>
                                            {website.kind === 'app' ? (
                                                <AppIcon packageName={website.key} size={26} />
                                            ) : (
                                                <Favicon url={website.label} size={22} />
                                            )}
                                        </View>
                                        <View style={styles.siteInfo}>
                                            <ThemedText weight="strong" numberOfLines={1}>
                                                {website.label}
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
                                                    {active ? 'Blocked now' : 'Paused'} ·{' '}
                                                    {describeSchedule(website.days, website.time)}
                                                </ThemedText>
                                            </View>
                                        </View>
                                        <IconButton
                                            icon="Hide"
                                            onPress={() => setDialog({ kind: 'hide', entry: website })}
                                        />
                                        <IconButton
                                            icon="Trash"
                                            onPress={() => setDialog({ kind: 'remove', entry: website })}
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

            <RemovePopup
                entry={dialog?.kind === 'remove' ? dialog.entry : null}
                onClose={close}
                onConfirm={confirmRemove}
            />
            <HidePopup
                entry={dialog?.kind === 'hide' ? dialog.entry : null}
                onClose={close}
                onConfirm={entry => apply(hide, entry)}
            />
            <PassphrasePopup
                visible={dialog?.kind === 'passphrase'}
                onClose={close}
                onConfirm={() => dialog?.kind === 'passphrase' && apply(remove, dialog.entry)}
            />
            <ErrorPopup
                title={dialog?.kind === 'error' ? dialog.title : ''}
                text={dialog?.kind === 'error' ? dialog.text : ''}
                visible={dialog?.kind === 'error'}
                onClose={close}
            />
        </BaseScreen>
    );
};

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

interface EntryPopupProps {
    /** The entry to act on; the popup is hidden while this is null. */
    entry: BlockEntry | null;
    onClose: () => void;
    onConfirm: (entry: BlockEntry) => void | Promise<void>;
}

const RemovePopup: React.FC<EntryPopupProps> = ({ entry, onClose, onConfirm }) => (
    <BlurModal visible={entry !== null} onClose={onClose}>
        <ThemedText size="large" weight="strong" align="center" style={styles.popupTitle}>
            Remove this block?
        </ThemedText>
        <ThemedText align="center" color="muted">
            <ThemedText color="accent" weight="strong">
                {entry?.label}
            </ThemedText>{' '}
            will no longer be blocked.
        </ThemedText>
        <View style={styles.popupButtonsContainer}>
            <ActionButton variant="cancel" onPress={onClose} />
            <ActionButton variant="confirm" label="Remove" onPress={() => (entry ? onConfirm(entry) : undefined)} />
        </View>
    </BlurModal>
);

const HidePopup: React.FC<EntryPopupProps> = ({ entry, onClose, onConfirm }) => (
    <BlurModal visible={entry !== null} onClose={onClose}>
        <ThemedText size="large" weight="strong" align="center" style={styles.popupTitle}>
            Hide{' '}
            <ThemedText size="large" weight="strong" color="accent">
                {entry?.label}
            </ThemedText>
            ?
        </ThemedText>
        <ThemedText color="muted" align="center">
            It stays blocked but disappears from this list.
        </ThemedText>
        <ThemedText size="small" weight="strong" color="primaryRed" align="center" style={styles.warning}>
            Once hidden, you won’t be able to remove it unless you clear the app’s data through your device settings!
        </ThemedText>
        <View style={styles.popupButtonsContainer}>
            <ActionButton variant="cancel" onPress={onClose} />
            <ActionButton variant="confirm" label="Hide" onPress={() => (entry ? onConfirm(entry) : undefined)} />
        </View>
    </BlurModal>
);

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
