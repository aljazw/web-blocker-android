import { NativeModules } from 'react-native';
import { ApneaKind, ApneaRecord, ApneaSettings } from '../types/types';
import { isApneaKind, recordFromSession, SessionPhase, SessionState, SessionStatus } from './apnea';
import { newId } from './dates';
import { addApneaRecord } from './storage';
import { completeLinkedHabits } from './habitLinks';
import { logger } from './logger';

/**
 * Bridge to the native ApneaSessionService, which owns the session clock so
 * training keeps running with the app closed. State arrives as JSON.
 */
const { ApneaSession } = NativeModules;

const IDLE: SessionState = {
    status: 'idle',
    id: '',
    kind: 'custom',
    title: '',
    phases: [],
    index: 0,
    phaseElapsedMs: 0,
    holds: [],
    contractions: [],
    startedAt: 0,
    endedAt: 0,
    completed: false,
};

const STATUSES: SessionStatus[] = ['idle', 'running', 'paused', 'finished'];

const parse = (raw: unknown): SessionState => {
    if (typeof raw !== 'string') {
        return IDLE;
    }
    try {
        const v = JSON.parse(raw);
        if (!STATUSES.includes(v.status) || v.status === 'idle') {
            return IDLE;
        }
        return {
            status: v.status,
            id: String(v.id),
            kind: isApneaKind(v.kind) ? v.kind : 'custom',
            title: String(v.title ?? ''),
            phases: Array.isArray(v.phases) ? v.phases : [],
            index: Number(v.index) || 0,
            phaseElapsedMs: Number(v.phaseElapsedMs) || 0,
            holds: Array.isArray(v.holds) ? v.holds : [],
            contractions: Array.isArray(v.contractions) ? v.contractions : [],
            startedAt: Number(v.startedAt) || 0,
            endedAt: Number(v.endedAt) || 0,
            completed: v.completed === true,
        };
    } catch {
        return IDLE;
    }
};

/** Runs a native call; any failure reads as "no session" rather than crashing the UI. */
const call = async (method: string, ...args: unknown[]): Promise<SessionState> => {
    try {
        return parse(await ApneaSession[method](...args));
    } catch (error) {
        logger.warn(`ApneaSession.${method} failed`, error);
        return IDLE;
    }
};

export interface SessionSpec {
    kind: ApneaKind;
    title: string;
    phases: SessionPhase[];
}

export class SessionBusyError extends Error {}

export const apneaSession = {
    /** Starts a session. Throws SessionBusyError if one is already running. */
    start: async (spec: SessionSpec, settings: ApneaSettings): Promise<SessionState> => {
        const payload = {
            id: newId('a'),
            kind: spec.kind,
            title: spec.title,
            phases: spec.phases,
            cues: {
                sound: settings.sound,
                vibration: settings.vibration,
                pulseEveryMs: settings.holdPulse ? 30_000 : 0,
            },
        };
        try {
            return parse(await ApneaSession.start(JSON.stringify(payload)));
        } catch (error: any) {
            if (error?.code === 'session_busy') {
                throw new SessionBusyError('A session is already running');
            }
            throw error;
        }
    },
    getState: () => call('getState'),
    pause: () => call('pause'),
    resume: () => call('resume'),
    /** Ends the current phase early ("End hold" / "Hold now" / stop a max hold). */
    skip: () => call('skip'),
    contraction: () => call('contraction'),
    stop: () => call('stop'),
    setKeepAwake: (enabled: boolean) => ApneaSession?.setKeepAwake(enabled),
    previewCue: (cue: 'HOLD' | 'BREATHE' | 'TICK', settings: Pick<ApneaSettings, 'sound' | 'vibration'>) =>
        ApneaSession?.previewCue(cue, settings.sound, settings.vibration).catch(() => undefined),
};

/**
 * Collects a finished session's result (exactly once, even if several screens
 * ask) and saves it to history. Returns the saved record, or null.
 */
export const collectFinishedSession = async (): Promise<ApneaRecord | null> => {
    let raw: unknown;
    try {
        raw = await ApneaSession.consumeResult();
    } catch (error) {
        logger.warn('Could not read session result', error);
        return null;
    }
    const state = parse(raw);
    if (state.status !== 'finished') {
        return null;
    }
    const record = recordFromSession(state);
    if (!record) {
        return null;
    }
    if (!(await addApneaRecord(record))) {
        logger.warn('Could not save session record');
        return null;
    }
    await completeLinkedHabits('apnea', new Date(record.startedAt)).catch(error =>
        logger.warn('Could not complete linked habits', error),
    );
    return record;
};
