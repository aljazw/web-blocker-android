/** Parsing what the native music player sends, so bad data never breaks the player UI. */
import { formatTime, nextRepeat, parseLibrary, parseMusicState } from '../src/utils/music';

test('state parses and falls back to idle on bad input', () => {
    const state = parseMusicState(
        JSON.stringify({ trackId: '7', title: 'Song', playing: true, count: 3, repeat: 'one', at: 5 }),
    );
    expect(state).toMatchObject({ trackId: '7', title: 'Song', playing: true, count: 3, repeat: 'one', at: 5 });
    expect(parseMusicState('not json').count).toBe(0);
    expect(parseMusicState(null).count).toBe(0);
    expect(parseMusicState(JSON.stringify({ repeat: 'sometimes' })).repeat).toBe('off');
});

test('library keeps only playable songs and fills gaps', () => {
    const tracks = parseLibrary(
        JSON.stringify([
            { id: '1', uri: 'content://a', title: '', artist: 'A', albumId: 4, durationMs: 1000 },
            { id: 2, uri: 'content://b' },
            null,
        ]),
    );
    expect(tracks).toEqual([
        { id: '1', uri: 'content://a', title: 'Unknown song', artist: 'A', album: '', albumId: 4, durationMs: 1000 },
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
