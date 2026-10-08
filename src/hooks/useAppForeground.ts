import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

/**
 * Calls `onForeground` whenever the app comes back from the background —
 * e.g. after the user returns from a system settings screen we sent them to.
 */
export const useAppForeground = (onForeground: () => void) => {
    const callback = useRef(onForeground);
    callback.current = onForeground;

    useEffect(() => {
        let previous = AppState.currentState;
        const subscription = AppState.addEventListener('change', next => {
            if (/inactive|background/.test(previous) && next === 'active') {
                callback.current();
            }
            previous = next;
        });
        return () => subscription.remove();
    }, []);
};
