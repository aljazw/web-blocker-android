import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import BackButton from '../components/BackButton';
import BaseScreen from '../components/BaseScreen';
import Button from '../components/Button';
import EmptyState from '../components/EmptyState';
import Icon from '../components/Icon';
import IconButton from '../components/IconButton';
import NotesPasswordDialog from '../components/NotesPasswordDialog';
import SearchBar from '../components/SearchBar';
import { ThemedText } from '../components/ThemedText';
import { useTheme } from '../context/ThemeContext';
import { gutter, shapes, spacing } from '../theme';
import { Note, RootStackNavigation } from '../types/types';
import { onStorageChange, STORAGE_KEYS } from '../storage';
import { shortDate } from '../utils/dates';
import { logger } from '../utils/logger';
import { loadNotes, lockNotes, notePreview, noteTitle, setNotesScreenSecure, useNotesUnlocked } from '../utils/notes';

/** Search shows once there are enough notes to need it. */
const SEARCH_FROM = 6;

const pad = (n: number) => `${n}`.padStart(2, '0');

/** "14:05" for today, otherwise a short date. */
export const noteDate = (ms: number, now: Date = new Date()) => {
    const date = new Date(ms);
    return date.toDateString() === now.toDateString()
        ? `${pad(date.getHours())}:${pad(date.getMinutes())}`
        : shortDate(date, now);
};

const NotesScreen: React.FC = () => {
    const { colors } = useTheme().theme;
    const navigation = useNavigation<RootStackNavigation>();
    const unlocked = useNotesUnlocked();
    const [notes, setNotes] = useState<Note[]>([]);
    const [loaded, setLoaded] = useState(false);
    const [query, setQuery] = useState('');
    /** A locked note waiting for the password, or '' to just unlock. */
    const [unlockFor, setUnlockFor] = useState<string | null>(null);

    const load = useCallback(async () => {
        try {
            setNotes(await loadNotes());
        } catch (error) {
            logger.warn('Could not load notes', error);
        } finally {
            setLoaded(true);
        }
    }, []);

    // Reload on focus, on lock / unlock, and when a backup import replaces the notes.
    useFocusEffect(
        useCallback(() => {
            load();
            return onStorageChange(key => {
                if (key === STORAGE_KEYS.notes) {
                    load();
                }
            });
        }, [load]),
    );
    useEffect(() => {
        load();
    }, [unlocked, load]);

    const hasProtected = notes.some(n => n.protected);
    useFocusEffect(
        useCallback(() => {
            setNotesScreenSecure(unlocked && hasProtected);
            return () => setNotesScreenSecure(false);
        }, [unlocked, hasProtected]),
    );

    const shown = useMemo(() => {
        const q = query.trim().toLowerCase();
        return q ? notes.filter(n => !n.locked && `${n.title}\n${n.body}`.toLowerCase().includes(q)) : notes;
    }, [notes, query]);

    const open = (note: Note) =>
        note.locked ? setUnlockFor(note.id) : navigation.navigate('NoteEditor', { noteId: note.id });

    const newNote = () => navigation.navigate('NoteEditor');

    const renderNote = ({ item, index }: { item: Note; index: number }) => (
        <Pressable
            onPress={() => open(item)}
            accessibilityRole="button"
            accessibilityLabel={noteTitle(item)}
            style={({ pressed }) => [
                styles.row,
                { backgroundColor: pressed ? colors.elevated : colors.card, borderColor: colors.border },
                index === 0 && styles.first,
                index === shown.length - 1 && styles.last,
                index > 0 && { borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth },
            ]}>
            <View style={styles.rowText}>
                <View style={styles.titleLine}>
                    {item.protected && (
                        <Icon
                            name={item.locked ? 'Lock' : 'Unlock'}
                            size={14}
                            tint={item.locked ? colors.muted : colors.accent}
                            style={styles.lock}
                        />
                    )}
                    <ThemedText
                        weight="medium"
                        numberOfLines={1}
                        style={styles.flex}
                        color={item.locked ? 'muted' : 'text'}>
                        {noteTitle(item)}
                    </ThemedText>
                    <ThemedText size="small" color="muted" tabular style={styles.date}>
                        {noteDate(item.updatedAt)}
                    </ThemedText>
                </View>
                {!!notePreview(item) && (
                    <ThemedText size="small" color="muted" numberOfLines={2} style={styles.preview}>
                        {notePreview(item)}
                    </ThemedText>
                )}
            </View>
        </Pressable>
    );

    return (
        <BaseScreen
            title="Notes"
            subtitle={
                notes.length ? `${notes.length} note${notes.length === 1 ? '' : 's'}` : 'Quick notes, some kept private'
            }
            headerLeft={<BackButton />}
            headerRight={
                <View style={styles.headerButtons}>
                    {hasProtected && (
                        <IconButton
                            icon={unlocked ? 'Unlock' : 'Lock'}
                            variant="outline"
                            accessibilityLabel={unlocked ? 'Lock protected notes' : 'Unlock protected notes'}
                            onPress={() => (unlocked ? lockNotes() : setUnlockFor(''))}
                        />
                    )}
                    <IconButton
                        icon="Plus"
                        variant="filled"
                        accessibilityLabel="New note"
                        onPress={newNote}
                        style={styles.headerGap}
                    />
                </View>
            }>
            {loaded && notes.length === 0 ? (
                <EmptyState
                    icon="Notes"
                    title="No notes yet"
                    text="Write down anything. Protect a note with a password and it’s encrypted, on this phone and in backups.">
                    <Button label="Write a note" icon="Plus" iconLeading onPress={newNote} style={styles.emptyButton} />
                </EmptyState>
            ) : (
                <FlatList
                    data={shown}
                    keyExtractor={n => n.id}
                    renderItem={renderNote}
                    keyboardShouldPersistTaps="handled"
                    contentContainerStyle={styles.list}
                    ListHeaderComponent={
                        notes.length >= SEARCH_FROM ? (
                            <View style={styles.search}>
                                <SearchBar
                                    placeholder="Search notes"
                                    value={query}
                                    onSearch={setQuery}
                                    keyboardType="default"
                                />
                            </View>
                        ) : null
                    }
                    ListEmptyComponent={
                        loaded && query ? (
                            <ThemedText color="muted" align="center" style={styles.noMatch}>
                                No notes match “{query.trim()}”
                                {hasProtected && !unlocked ? '. Locked notes aren’t searched.' : ''}
                            </ThemedText>
                        ) : null
                    }
                />
            )}

            <NotesPasswordDialog
                mode={unlockFor !== null ? 'unlock' : null}
                onClose={() => setUnlockFor(null)}
                onDone={() => {
                    const id = unlockFor;
                    setUnlockFor(null);
                    if (id) {
                        navigation.navigate('NoteEditor', { noteId: id });
                    }
                }}
                onReset={load}
            />
        </BaseScreen>
    );
};

const styles = StyleSheet.create({
    flex: {
        flex: 1,
    },
    headerButtons: {
        flexDirection: 'row',
    },
    headerGap: {
        marginLeft: spacing.sm,
    },
    list: {
        paddingTop: spacing.sm,
        paddingBottom: spacing.xl,
    },
    search: {
        marginBottom: spacing.md,
    },
    row: {
        marginHorizontal: gutter,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.md - 2,
        borderLeftWidth: shapes.borderWidth.thin,
        borderRightWidth: shapes.borderWidth.thin,
    },
    first: {
        borderTopWidth: shapes.borderWidth.thin,
        borderTopLeftRadius: shapes.borderRadius.large,
        borderTopRightRadius: shapes.borderRadius.large,
    },
    last: {
        borderBottomWidth: shapes.borderWidth.thin,
        borderBottomLeftRadius: shapes.borderRadius.large,
        borderBottomRightRadius: shapes.borderRadius.large,
    },
    rowText: {
        flex: 1,
    },
    titleLine: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    lock: {
        marginRight: spacing.xs + 2,
    },
    date: {
        marginLeft: spacing.sm,
    },
    preview: {
        marginTop: 2,
    },
    emptyButton: {
        marginTop: spacing.md,
    },
    noMatch: {
        marginTop: spacing.xl,
        marginHorizontal: gutter,
    },
});

export default NotesScreen;
