import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, Linking, Pressable, StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import BackButton from '../components/BackButton';
import BaseScreen from '../components/BaseScreen';
import Button from '../components/Button';
import EmptyState from '../components/EmptyState';
import IconTile from '../components/IconTile';
import { NowPlaying } from '../components/MusicPlayer';
import SearchBar from '../components/SearchBar';
import { ThemedText } from '../components/ThemedText';
import { useTheme } from '../context/ThemeContext';
import { gutter, spacing } from '../theme';
import {
    LibraryAccess,
    Track,
    checkLibraryAccess,
    formatTime,
    getLibrary,
    music,
    requestLibraryAccess,
    useMusic,
} from '../utils/music';
import { logger } from '../utils/logger';

const ROW_HEIGHT = 60;

const matches = (track: Track, query: string) =>
    track.title.toLowerCase().includes(query) ||
    track.artist.toLowerCase().includes(query) ||
    track.album.toLowerCase().includes(query);

/** The songs on the phone and the player. Music keeps going after leaving this screen or the app. */
const MusicScreen: React.FC = () => {
    const { colors } = useTheme().theme;
    const state = useMusic();
    const [access, setAccess] = useState<LibraryAccess | null>(null);
    const [library, setLibrary] = useState<Track[]>([]);
    const [loaded, setLoaded] = useState(false);
    const [query, setQuery] = useState('');

    const load = useCallback(async () => {
        try {
            const now = await checkLibraryAccess();
            setAccess(prev => (prev === 'blocked' && now !== 'granted' ? prev : now));
            if (now === 'granted') {
                setLibrary(await getLibrary());
            }
        } catch (error) {
            logger.warn('Could not load music', error);
        } finally {
            setLoaded(true);
        }
    }, []);

    // Also after coming back from system settings with access just granted.
    useFocusEffect(
        useCallback(() => {
            load();
        }, [load]),
    );

    const allow = async () => {
        if (access === 'blocked') {
            Linking.openSettings();
            return;
        }
        const result = await requestLibraryAccess();
        setAccess(result);
        if (result === 'granted') {
            load();
        }
    };

    const q = query.trim().toLowerCase();
    const shown = useMemo(() => (q ? library.filter(t => matches(t, q)) : library), [library, q]);

    const renderItem = useCallback(
        ({ item, index }: { item: Track; index: number }) => {
            const current = item.id === state.trackId && state.count > 0;
            return (
                <Pressable
                    onPress={() => music.play(shown, index)}
                    accessibilityRole="button"
                    accessibilityLabel={`${item.title}${item.artist ? `, ${item.artist}` : ''}`}
                    style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.elevated }]}>
                    <IconTile
                        icon={current && state.playWhenReady ? 'Sound' : 'Music'}
                        tone={current ? 'accent' : 'neutral'}
                    />
                    <View style={styles.rowText}>
                        <ThemedText weight="medium" numberOfLines={1} color={current ? 'accent' : 'text'}>
                            {item.title}
                        </ThemedText>
                        <ThemedText size="small" color="muted" numberOfLines={1}>
                            {item.artist || 'Unknown artist'}
                        </ThemedText>
                    </View>
                    <ThemedText size="small" color="muted" tabular>
                        {formatTime(item.durationMs)}
                    </ThemedText>
                </Pressable>
            );
        },
        [shown, state.trackId, state.count, state.playWhenReady, colors.elevated],
    );

    const header = (
        <View>
            {state.count > 0 && (
                <View style={styles.player}>
                    <NowPlaying state={state} />
                </View>
            )}
            <View style={styles.search}>
                <SearchBar
                    placeholder="Search songs or artists"
                    keyboardType="default"
                    onSearch={setQuery}
                    value={query}
                />
            </View>
            <View style={styles.actions}>
                <ThemedText size="small" color="muted">
                    {q ? `${shown.length} of ${library.length} songs` : `${library.length} songs`}
                </ThemedText>
                <Button
                    label="Shuffle"
                    icon="Shuffle"
                    iconLeading
                    variant="ghost"
                    compact
                    disabled={shown.length === 0}
                    onPress={() => music.play(shown, Math.floor(Math.random() * shown.length), true)}
                />
            </View>
        </View>
    );

    const blocked = loaded && access !== 'granted';
    const empty = loaded && access === 'granted' && library.length === 0;

    return (
        <BaseScreen
            title="Music"
            subtitle="Keeps playing in the background"
            headerLeft={<BackButton />}
            isLoading={!loaded}>
            {blocked ? (
                <View style={styles.pad}>
                    <EmptyState
                        icon="Music"
                        title="Play your music"
                        text="Gaman plays the songs saved on this phone, and keeps playing while you train, plan or use other apps.">
                        <Button
                            label={access === 'blocked' ? 'Allow in settings' : 'Allow access to music'}
                            onPress={allow}
                        />
                    </EmptyState>
                </View>
            ) : empty ? (
                <View style={styles.pad}>
                    {state.count > 0 && <NowPlaying state={state} />}
                    <EmptyState
                        icon="Music"
                        title="No songs found"
                        text="Copy music files to this phone (for example into the Music folder) and they'll show up here."
                    />
                </View>
            ) : (
                <FlatList
                    data={shown}
                    keyExtractor={t => t.id}
                    renderItem={renderItem}
                    ListHeaderComponent={header}
                    getItemLayout={(_, index) => ({ length: ROW_HEIGHT, offset: ROW_HEIGHT * index, index })}
                    keyboardShouldPersistTaps="handled"
                    keyboardDismissMode="on-drag"
                    initialNumToRender={16}
                    windowSize={9}
                    contentContainerStyle={styles.list}
                    ListEmptyComponent={
                        <ThemedText color="muted" align="center" style={styles.none}>
                            No songs match “{query.trim()}”
                        </ThemedText>
                    }
                />
            )}
        </BaseScreen>
    );
};

const styles = StyleSheet.create({
    pad: {
        paddingTop: spacing.xs,
    },
    player: {
        marginTop: spacing.xs,
    },
    search: {
        marginHorizontal: gutter,
        marginTop: spacing.md,
    },
    actions: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginHorizontal: gutter + 2,
        marginTop: spacing.sm,
        marginBottom: spacing.xs,
    },
    list: {
        paddingBottom: spacing.xl,
    },
    row: {
        height: ROW_HEIGHT,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: gutter,
    },
    rowText: {
        flex: 1,
        marginHorizontal: spacing.sm + 2,
    },
    none: {
        marginTop: spacing.xl,
    },
});

export default MusicScreen;
