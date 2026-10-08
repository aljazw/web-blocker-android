import { ScrollView, StyleSheet, View } from 'react-native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { BlockEntry, RootStackNavigation } from '../types/types';
import AppIcon from '../components/AppIcon';
import Badge from '../components/Badge';
import BaseScreen from '../components/BaseScreen';
import Button from '../components/Button';
import Card from '../components/Card';
import Dialog, { confirmActions } from '../components/Dialog';
import ErrorPopup from '../components/ErrorPopup';
import Favicon from '../components/Favicon';
import IconButton from '../components/IconButton';
import IconTile from '../components/IconTile';
import { ListGroup } from '../components/ListGroup';
import PassphrasePopup from '../components/PassphrasePopup';
import SearchBar from '../components/SearchBar';
import SectionHeader from '../components/SectionHeader';
import StatRow from '../components/StatRow';
import StatTile from '../components/StatTile';
import { ThemedText } from '../components/ThemedText';
import { FadeIn, animateLayout } from '../components/Motion';
import { usePassphrase } from '../context/PassphraseContext';
import { useTheme } from '../context/ThemeContext';
import { useBlockList } from '../hooks/useBlockList';
import { useHabits } from '../hooks/useHabits';
import { useApneaData } from '../hooks/useApneaData';
import { useAppForeground } from '../hooks/useAppForeground';
import { gutter, spacing } from '../theme';
import { checkAccessibilityEnabled, openAccessibilitySettings } from '../utils/accessibility';
import { describeSchedule, isBlockActiveNow } from '../utils/schedule';
import { currentStreak, isDoneOn, isScheduled } from '../utils/habits';
import { formatClock, personalBest } from '../utils/apnea';
import { haptics } from '../utils/haptics';
import { ERRORS } from '../constants/strings';

/** One dialog at a time. */
type Dialog =
    | { kind: 'remove'; entry: BlockEntry }
    | { kind: 'hide'; entry: BlockEntry }
    | { kind: 'passphrase'; entry: BlockEntry }
    | { kind: 'error'; title: string; text: string };

const greeting = (date: Date) => {
    const h = date.getHours();
    if (h < 5) {
        return 'Good night';
    }
    if (h < 12) {
        return 'Good morning';
    }
    if (h < 18) {
        return 'Good afternoon';
    }
    return 'Good evening';
};

const SEARCH_THRESHOLD = 5;

const HomeScreen: React.FC = () => {
    const { theme } = useTheme();
    const navigation = useNavigation<RootStackNavigation>();

    const { isPassphraseEnabled } = usePassphrase();
    const { entries, loadFailed, remove, hide } = useBlockList();
    const { habits } = useHabits();
    // Finished sessions are left for the session screen, which shows their summary.
    const { records } = useApneaData({ collect: false });
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
    // Coming back from Accessibility settings should update the status at once.
    useAppForeground(refreshProtection);

    useEffect(() => {
        if (loadFailed) {
            setDialog({ kind: 'error', ...ERRORS.dataLoadError });
        }
    }, [loadFailed]);

    // Keep "Active" badges fresh while the screen is open.
    useEffect(() => {
        const id = setInterval(() => setNow(new Date()), 60_000);
        return () => clearInterval(id);
    }, []);

    /** Runs a list change and reports failure in the error dialog. */
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

    const visible = useMemo(() => entries.filter(w => w.visible), [entries]);
    const activeCount = useMemo(() => entries.filter(w => isBlockActiveNow(w, now)).length, [entries, now]);
    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        return q ? visible.filter(w => w.label.toLowerCase().includes(q)) : visible;
    }, [visible, query]);

    const dueToday = habits.filter(h => isScheduled(h, now));
    const doneToday = dueToday.filter(h => isDoneOn(h, now)).length;
    const habitStreak = habits.reduce((max, h) => Math.max(max, currentStreak(h, now)), 0);
    const best = useMemo(() => personalBest(records), [records]);

    const goToAdd = () => navigation.navigate('BottomTabs', { screen: 'Block' });

    return (
        <BaseScreen
            title={greeting(now)}
            subtitle={now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}>
            <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
                {/* ---- Protection status ---- */}
                <FadeIn>
                    <Card highlight={protectionOn === false ? theme.colors.primaryRed : undefined}>
                        <View style={styles.statusTop}>
                            <IconTile
                                icon={protectionOn === false ? 'ShieldOff' : 'Shield'}
                                tone={protectionOn === false ? 'danger' : 'accent'}
                                size={40}
                            />
                            <View style={styles.statusText}>
                                <ThemedText weight="strong">
                                    {protectionOn === false ? 'Protection is off' : 'Protection is on'}
                                </ThemedText>
                                <ThemedText size="small" color="muted" tabular>
                                    {activeCount} of {entries.length} block{entries.length === 1 ? '' : 's'} active now
                                </ThemedText>
                            </View>
                            {protectionOn !== null && (
                                <Badge
                                    label={protectionOn ? 'Active' : 'Off'}
                                    tone={protectionOn ? 'success' : 'danger'}
                                    dot
                                />
                            )}
                        </View>
                        {protectionOn === false && (
                            <Button
                                label="Turn protection on"
                                compact
                                onPress={openAccessibilitySettings}
                                style={styles.statusButton}
                            />
                        )}
                    </Card>

                    <StatRow>
                        <StatTile
                            label="Habits today"
                            value={habits.length ? `${doneToday}/${dueToday.length}` : '—'}
                        />
                        <StatTile label="Habit streak" value={habitStreak} suffix=" d" />
                        <StatTile label="Apnea best" value={best ? formatClock(best.ms) : '—'} />
                    </StatRow>
                </FadeIn>

                {/* ---- Block list ---- */}
                <SectionHeader
                    title={`Block list · ${visible.length}`}
                    right={
                        visible.length > 0 ? (
                            <Button
                                label="Add"
                                icon="Plus"
                                iconLeading
                                variant="ghost"
                                compact
                                onPress={goToAdd}
                                style={styles.add}
                            />
                        ) : undefined
                    }
                />

                {visible.length === 0 ? (
                    <FadeIn delay={60}>
                        <Card style={styles.empty}>
                            <IconTile icon="Ban" tone="accent" size={44} />
                            <ThemedText size="large" weight="bold" style={styles.emptyTitle}>
                                Nothing blocked yet
                            </ThemedText>
                            <ThemedText color="muted" style={styles.emptyText}>
                                Add the websites and apps that take your time. Block them all day or only during the
                                hours you choose.
                            </ThemedText>
                            <Button label="Add a block" icon="Plus" iconLeading onPress={goToAdd} />
                        </Card>
                    </FadeIn>
                ) : (
                    <>
                        {visible.length > SEARCH_THRESHOLD && (
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
                        {filtered.length > 0 ? (
                            <ListGroup>
                                {filtered.map(entry => (
                                    <BlockRow
                                        key={`${entry.kind}:${entry.key}`}
                                        entry={entry}
                                        active={isBlockActiveNow(entry, now)}
                                        onHide={() => setDialog({ kind: 'hide', entry })}
                                        onRemove={() => setDialog({ kind: 'remove', entry })}
                                    />
                                ))}
                            </ListGroup>
                        ) : (
                            <ThemedText color="muted" align="center" style={styles.noMatches}>
                                No blocks match “{query}”
                            </ThemedText>
                        )}
                    </>
                )}
            </ScrollView>

            <Dialog
                visible={dialog?.kind === 'remove'}
                onClose={close}
                icon="Trash"
                tone="danger"
                title="Remove this block?"
                message={`${dialog?.kind === 'remove' ? dialog.entry.label : ''} will no longer be blocked.`}
                actions={confirmActions(
                    close,
                    'Remove',
                    async () => {
                        if (dialog?.kind === 'remove') {
                            await confirmRemove(dialog.entry);
                        }
                    },
                    true,
                )}
            />
            <Dialog
                visible={dialog?.kind === 'hide'}
                onClose={close}
                icon="Hide"
                title={`Hide ${dialog?.kind === 'hide' ? dialog.entry.label : ''}?`}
                message={
                    <View>
                        <ThemedText color="muted">It stays blocked but no longer appears in this list.</ThemedText>
                        <ThemedText size="small" weight="medium" color="primaryRed" style={styles.warning}>
                            A hidden block can only be removed by clearing SiteLock's data in your phone's settings.
                        </ThemedText>
                    </View>
                }
                actions={confirmActions(close, 'Hide', async () => {
                    if (dialog?.kind === 'hide') {
                        await apply(hide, dialog.entry);
                    }
                })}
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

interface BlockRowProps {
    entry: BlockEntry;
    active: boolean;
    onHide: () => void;
    onRemove: () => void;
}

const BlockRow: React.FC<BlockRowProps> = ({ entry, active, onHide, onRemove }) => (
    <View style={styles.row}>
        <IconTile size={36}>
            {entry.kind === 'app' ? (
                <AppIcon packageName={entry.key} size={24} />
            ) : (
                <Favicon url={entry.label} size={20} />
            )}
        </IconTile>
        <View style={styles.rowText}>
            <ThemedText weight="medium" numberOfLines={1}>
                {entry.label}
            </ThemedText>
            <ThemedText size="small" color="muted" numberOfLines={1}>
                {describeSchedule(entry.days, entry.time)}
            </ThemedText>
        </View>
        <Badge label={active ? 'Active' : 'Paused'} tone={active ? 'success' : 'neutral'} style={styles.rowBadge} />
        <IconButton icon="Hide" size={34} accessibilityLabel={`Hide ${entry.label}`} onPress={onHide} />
        <IconButton icon="Trash" size={34} accessibilityLabel={`Remove ${entry.label}`} onPress={onRemove} />
    </View>
);

const styles = StyleSheet.create({
    scroll: {
        paddingBottom: spacing.xl,
    },
    statusTop: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    statusText: {
        flex: 1,
        marginHorizontal: spacing.sm + 2,
    },
    statusButton: {
        marginTop: spacing.md,
    },
    add: {
        marginVertical: -8,
        marginRight: -spacing.sm,
    },
    search: {
        marginHorizontal: gutter,
        marginBottom: spacing.sm,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        paddingLeft: spacing.md,
        paddingRight: spacing.xs,
    },
    rowText: {
        flex: 1,
        marginHorizontal: spacing.sm + 2,
    },
    rowBadge: {
        alignSelf: 'center',
        marginRight: 2,
    },
    empty: {
        padding: spacing.lg,
    },
    emptyTitle: {
        marginTop: spacing.md,
    },
    emptyText: {
        marginTop: spacing.xs,
        marginBottom: spacing.lg,
    },
    noMatches: {
        marginTop: spacing.lg,
    },
    warning: {
        marginTop: spacing.sm,
    },
});

export default HomeScreen;
