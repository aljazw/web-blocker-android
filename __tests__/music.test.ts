/** Parsing what the native music player sends, so bad data never breaks the player UI. */
import {
    Track,
    folderName,
    formatTime,
    inFolder,
    listFolders,
    nextRepeat,
    parseLibrary,
    parseMusicState,
} from '../src/utils/music';

test('state parses and falls back to idle on bad input', () => {
    const state = parseMusicState(
        JSON.stringify({ trackId: '7', title: 'Song', playing: true, count: 3, repeat: 'one', at: 5 }),
    );
    expect(state).toMatchObject({ trackId: '7', title: 'Song', playing: true, count: 3, repeat: 'one', at: 5 });
    expect(parseMusicState('not json').count).toBe(0);
    expect(parseMusicState(null).count).toBe(0);
    expect(parseMusicState(JSON.stringify({ repeat: 'sometimes' })).repeat).toBe('off');
    expect(parseMusicState(JSON.stringify({ sleepAt: 99, sleepEndOfSong: true }))).toMatchObject({
        sleepAt: 99,
        sleepEndOfSong: true,
    });
    expect(parseMusicState(JSON.stringify({ sleepAt: 'soon' })).sleepAt).toBe(0);
});

test('library keeps only playable songs and fills gaps', () => {
    const tracks = parseLibrary(
        JSON.stringify([
            { id: '1', uri: 'content://a', title: '', artist: 'A', albumId: 4, durationMs: 1000, folder: 'Music/' },
            { id: 2, uri: 'content://b' },
            null,
        ]),
    );
    expect(tracks).toEqual([
        {
            id: '1',
            uri: 'content://a',
            title: 'Unknown song',
            artist: 'A',
            album: '',
            albumId: 4,
            durationMs: 1000,
            folder: 'Music/',
            music: true,
        },
    ]);
    expect(parseLibrary('{')).toEqual([]);
});

test('time and repeat helpers', () => {
    expect(formatTime(0)).toBe('0:00');
    expect(formatTime(185_400)).toBe('3:05');
    expect(nextRepeat('off')).toBe('all');
    expect(nextRepeat('all')).toBe('one');
    expect(nextRepeat('one')).toBe('off');
});

test('folders include their subfolders; all songs means music only', () => {
    const track = (id: string, folder: string, isMusic = true): Track => ({
        id,
        uri: `content://${id}`,
        title: id,
        artist: '',
        album: '',
        albumId: -1,
        durationMs: 0,
        folder,
        music: isMusic,
    });
    const tracks = [track('a', 'Music/'), track('b', 'Music/Gym/'), track('c', 'Recordings/', false)];
    expect(listFolders(tracks)).toEqual([
        { path: 'Music/', count: 2 },
        { path: 'Music/Gym/', count: 1 },
        { path: 'Recordings/', count: 1 },
    ]);
    expect(tracks.filter(t => inFolder(t, '')).map(t => t.id)).toEqual(['a', 'b']);
    expect(tracks.filter(t => inFolder(t, 'Music/')).map(t => t.id)).toEqual(['a', 'b']);
    expect(tracks.filter(t => inFolder(t, 'Recordings/')).map(t => t.id)).toEqual(['c']);
    expect(folderName('Music/Gym/')).toBe('Gym');
});
