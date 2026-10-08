import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { ApneaRecord, ApneaSettings, CustomTable } from '../types/types';
import {
    DEFAULT_APNEA_SETTINGS,
    getApneaRecords,
    getApneaSettings,
    getCustomTables,
    updateApneaSettings,
} from '../utils/storage';
import { collectFinishedSession } from '../utils/apneaSession';
import { logger } from '../utils/logger';

/**
 * History, custom tables and settings for apnea training, reloaded on focus.
 * By default also collects a session that finished while the app was closed;
 * pass `collect: false` on screens that should leave that to the session summary.
 */
export const useApneaData = ({ collect = true }: { collect?: boolean } = {}) => {
    const [records, setRecords] = useState<ApneaRecord[]>([]);
    const [tables, setTables] = useState<CustomTable[]>([]);
    const [settings, setSettings] = useState<ApneaSettings>(DEFAULT_APNEA_SETTINGS);
    const [loaded, setLoaded] = useState(false);

    const reload = useCallback(async () => {
        try {
            if (collect) {
                await collectFinishedSession();
            }
            const [r, t, s] = await Promise.all([getApneaRecords(), getCustomTables(), getApneaSettings()]);
            setRecords(r);
            setTables(t);
            setSettings(s);
        } catch (error) {
            logger.warn('Could not load apnea data', error);
        } finally {
            setLoaded(true);
        }
    }, [collect]);

    useFocusEffect(
        useCallback(() => {
            reload();
        }, [reload]),
    );

    /** Saves a settings change, updating the screen at once. */
    const changeSettings = useCallback(async (change: Partial<ApneaSettings>) => {
        setSettings(prev => ({ ...prev, ...change }));
        const saved = await updateApneaSettings(change);
        if (saved) {
            setSettings(saved);
        }
        return saved !== null;
    }, []);

    return { records, tables, settings, loaded, reload, changeSettings };
};
