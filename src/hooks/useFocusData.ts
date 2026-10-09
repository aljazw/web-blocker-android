import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { onStorageChange } from '../storage';
import { logger } from '../utils/logger';

/** Same array items or object values (by identity): nothing to re-render. */
const shallowEqual = (a: unknown, b: unknown): boolean => {
    if (Object.is(a, b)) {
        return true;
    }
    if (!a || !b || typeof a !== 'object' || typeof b !== 'object' || Array.isArray(a) !== Array.isArray(b)) {
        return false;
    }
    const ka = Object.keys(a);
    const kb = Object.keys(b);
    return ka.length === kb.length && ka.every(k => Object.is((a as any)[k], (b as any)[k]));
};

interface Options {
    /** Storage keys whose changes (from any screen or pop-up) trigger a reload. */
    watch?: readonly string[];
}

/**
 * Loads data when the screen mounts, again whenever it regains focus, and
 * when a watched storage key changes. Storage returns the same objects while
 * nothing changed, so a reload that finds no change doesn't re-render.
 */
export function useFocusData<T>(load: () => Promise<T>, initial: T, { watch = [] }: Options = {}) {
    const [data, setData] = useState<T>(initial);
    const [loaded, setLoaded] = useState(false);
    const [failed, setFailed] = useState(false);
    const latest = useRef(0);

    const reload = useCallback(async () => {
        const run = ++latest.current;
        try {
            const next = await load();
            // A newer reload started meanwhile: let that one win.
            if (run === latest.current) {
                setData(prev => (shallowEqual(prev, next) ? prev : next));
                setFailed(false);
            }
        } catch (error) {
            logger.warn('Could not load data', error);
            if (run === latest.current) {
                setFailed(true);
            }
        } finally {
            if (run === latest.current) {
                setLoaded(true);
            }
        }
    }, [load]);

    useEffect(() => {
        reload();
    }, [reload]);

    // Skips the focus that comes with mounting; the effect above already loaded.
    const focusedOnce = useRef(false);
    useFocusEffect(
        useCallback(() => {
            if (focusedOnce.current) {
                reload();
            }
            focusedOnce.current = true;
        }, [reload]),
    );

    const watchKey = watch.join('|');
    useEffect(() => {
        if (!watchKey) {
            return;
        }
        const keys = new Set(watchKey.split('|'));
        let timer: ReturnType<typeof setTimeout> | null = null;
        const unsubscribe = onStorageChange(key => {
            // Coalesce a burst of writes into one reload.
            if (keys.has(key) && !timer) {
                timer = setTimeout(() => {
                    timer = null;
                    reload();
                }, 0);
            }
        });
        return () => {
            unsubscribe();
            if (timer) {
                clearTimeout(timer);
            }
        };
    }, [watchKey, reload]);

    return { data, setData, loaded, failed, reload };
}
