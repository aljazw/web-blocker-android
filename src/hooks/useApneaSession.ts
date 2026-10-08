import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import { ApneaSettings, RootStackNavigation } from '../types/types';
import { SessionState } from '../utils/apnea';
import { apneaSession, SessionBusyError, SessionSpec } from '../utils/apneaSession';
import { logger } from '../utils/logger';

/**
 * Live view of the native session. Polls while this screen is focused, the
 * app is in the foreground and a session is running; actions apply instantly
 * and return fresh state. Screens that only summarise the session can pass a
 * slower `pollMs`.
 */
export const useApneaSession = (pollMs = 200) => {
    const focused = useIsFocused();
    const [state, setState] = useState<SessionState | null>(null);
    /** When `state` arrived, so the UI can extrapolate between polls. */
    const receivedAt = useRef(Date.now());

    const apply = useCallback((next: SessionState) => {
        receivedAt.current = Date.now();
        setState(next);
        return next;
    }, []);

    const refresh = useCallback(() => apneaSession.getState().then(apply), [apply]);

    const live = state?.status === 'running' || state?.status === 'paused';

    useEffect(() => {
        refresh();
        const sub = AppState.addEventListener('change', s => s === 'active' && refresh());
        return () => sub.remove();
    }, [refresh]);

    useEffect(() => {
        if (!live || !focused) {
            return;
        }
        refresh();
        const id = setInterval(refresh, pollMs);
        return () => clearInterval(id);
    }, [live, focused, pollMs, refresh]);

    const run = useCallback((action: () => Promise<SessionState>) => () => action().then(apply), [apply]);

    return {
        state,
        receivedAt,
        refresh,
        pause: run(apneaSession.pause),
        resume: run(apneaSession.resume),
        skip: run(apneaSession.skip),
        contraction: run(apneaSession.contraction),
        stop: run(apneaSession.stop),
    };
};

/**
 * Starts a session and opens the session screen. If a session is already
 * running, opens that one instead. Returns false if the session couldn't start.
 */
export const useStartSession = () => {
    const navigation = useNavigation<RootStackNavigation>();
    return useCallback(
        async (spec: SessionSpec, settings: ApneaSettings): Promise<boolean> => {
            try {
                await apneaSession.start(spec, settings);
            } catch (error) {
                if (!(error instanceof SessionBusyError)) {
                    logger.warn('Could not start session', error);
                    return false;
                }
            }
            navigation.navigate('ApneaSession');
            return true;
        },
        [navigation],
    );
};
