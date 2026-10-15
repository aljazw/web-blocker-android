import { useEffect, useState, useSyncExternalStore } from 'react';
import { NativeEventEmitter, NativeModules, PermissionsAndroid, Platform } from 'react-native';
import { logger } from './logger';

/**
 * Bridge to the native MusicService, which keeps playing with the app in the
 * background or closed. Songs and state cross the bridge as JSON.
 */
const { Music } = NativeModules;

export interface Track {
    id: string;
    uri: string;
    title: string;
    artist: string;
    album: string;
    albumId: number;
    durationMs: number;
}

export type RepeatMode = 'off' | 'all' | 'one';

export interface MusicState {
    trackId: string;
    title: string;
    artist: string;
    playing: boolean;
    /** Playing or about to be (buffering): the button shows pause. */
    playWhenReady: boolean;
    positionMs: number;
    durationMs: number;
    index: number;
    /** Songs in the queue; 0 = nothing loaded, so no player is shown. */
    count: number;
    shuffle: boolean;
    repeat: RepeatMode;
    /** When positionMs was read (epoch millis). */
    at: number;
}

const IDLE: MusicState = {
    trackId: '',
    title: '',
    artist: '',
    playing: false,
    playWhenReady: false,
    positionMs: 0,
    durationMs: 0,
    index: 0,
    count: 0,
    shuffle: false,
    repeat: 'off',
    at: 0,
};

const REPEATS: RepeatMode[] = ['off', 'all', 'one'];
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const str = (v: unknown) => (typeof v === 'string' ? v : '');

export const parseMusicState = (raw: unknown): MusicState => {
    if (typeof raw !== 'string') {
        return IDLE;
    }
    try {
        const v = JSON.parse(raw);
        return {
            trackId: str(v.trackId),
            title: str(v.title),
            artist: str(v.artist),
            playing: v.playing === true,
            playWhenReady: v.playWhenReady === true,
            positionMs: num(v.positionMs),
            durationMs: num(v.durationMs),
            index: num(v.index),
            count: num(v.count),
            shuffle: v.shuffle === true,
            repeat: REPEATS.includes(v.repeat) ? v.repeat : 'off',
            at: num(v.at) || Date.now(),
        };
    } catch {
        return IDLE;
    }
};

export const parseLibrary = (raw: unknown): Track[] => {
    if (typeof raw !== 'string') {
        return [];
    }
    try {
        const list = JSON.parse(raw);
        return Array.isArray(list)
            ? list
                  .filter(t => t && typeof t.id === 'string' && typeof t.uri === 'string')
                  .map(t => ({
                      id: t.id,
                      uri: t.uri,
                      title: str(t.title) || 'Unknown song',
                      artist: str(t.artist),
                      album: str(t.album),
                      albumId: typeof t.albumId === 'number' ? t.albumId : -1,
                      durationMs: num(t.durationMs),
                  }))
            : [];
    } catch {
        return [];
    }
};

// ---- Shared state -----------------------------------------------------------

let current: MusicState = IDLE;
const listeners = new Set<() => void>();
let started = false;

const set = (next: MusicState) => {
    current = next;
    listeners.forEach(l => l());
};

/** Runs a player call and takes the state it answers with. Failures are logged, never thrown. */
const call = async (run: () => Promise<unknown>) => {
    if (!Music) {
        return;
    }
    try {
        set(parseMusicState(await run()));
    } catch (error) {
        logger.warn('Music call failed', error);
    }
};

const start = () => {
    if (started || !Music) {
        return;
    }
    started = true;
    new NativeEventEmitter(Music).addListener('MusicState', raw => set(parseMusicState(raw)));
    call(() => Music.getState());
};

const subscribe = (listener: () => void) => {
    start();
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
};

/** The player's state, kept current from native events. */
export const useMusic = (): MusicState => useSyncExternalStore(subscribe, () => current);

/** The playing position, moved along between native updates while playing. */
export const useMusicPosition = (state: MusicState): number => {
    const [now, setNow] = useState(Date.now);
    useEffect(() => {
        if (!state.playing) {
            return;
        }
        const timer = setInterval(() => setNow(Date.now()), 500);
        return () => clearInterval(timer);
    }, [state.playing]);
    const position = state.playing ? state.positionMs + Math.max(0, now - state.at) : state.positionMs;
    return state.durationMs ? Math.min(position, state.durationMs) : position;
};

// ---- Controls ---------------------------------------------------------------

export const music = {
    available: !!Music,
    play: (queue: Track[], index: number, shuffle = false) =>
        call(() => Music.play(JSON.stringify(queue), index, shuffle)),
    toggle: () => call(() => Music.toggle()),
    next: () => call(() => Music.next()),
    previous: () => call(() => Music.previous()),
    seekTo: (ms: number) => call(() => Music.seekTo(Math.max(0, Math.round(ms)))),
    setShuffle: (enabled: boolean) => call(() => Music.setShuffle(enabled)),
    setRepeat: (mode: RepeatMode) => call(() => Music.setRepeat(mode)),
    stop: () => call(() => Music.stop()),
};

export const nextRepeat = (mode: RepeatMode): RepeatMode => REPEATS[(REPEATS.indexOf(mode) + 1) % REPEATS.length];

// ---- Library ----------------------------------------------------------------

const AUDIO_PERMISSION =
    Platform.OS === 'android' && Number(Platform.Version) >= 33
        ? PermissionsAndroid.PERMISSIONS.READ_MEDIA_AUDIO
        : PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE;

export type LibraryAccess = 'granted' | 'ask' | 'blocked';

export const checkLibraryAccess = async (): Promise<LibraryAccess> =>
    (await PermissionsAndroid.check(AUDIO_PERMISSION)) ? 'granted' : 'ask';

export const requestLibraryAccess = async (): Promise<LibraryAccess> => {
    const result = await PermissionsAndroid.request(AUDIO_PERMISSION);
    return result === PermissionsAndroid.RESULTS.GRANTED
        ? 'granted'
        : result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN
        ? 'blocked'
        : 'ask';
};

/** Every song on the phone, by title. */
export const getLibrary = async (): Promise<Track[]> => (Music ? parseLibrary(await Music.getLibrary()) : []);

export const formatTime = (ms: number) => {
    const total = Math.max(0, Math.floor(ms / 1000));
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
};
