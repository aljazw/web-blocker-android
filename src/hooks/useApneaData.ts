import { useCallback } from 'react';
import { ApneaRecord, ApneaSettings, CustomTable } from '../types/types';
import {
    DEFAULT_APNEA_SETTINGS,
    STORAGE_KEYS,
    getApneaRecords,
    getApneaSettings,
    getCustomTables,
    updateApneaSettings,
} from '../storage';
import { collectFinishedSession } from '../utils/apneaSession';
import { logger } from '../utils/logger';
import { useFocusData } from './useFocusData';

const EMPTY: [ApneaRecord[], CustomTable[], ApneaSettings] = [[], [], DEFAULT_APNEA_SETTINGS];
const WATCH = [STORAGE_KEYS.apneaRecords, STORAGE_KEYS.apneaTables, STORAGE_KEYS.apneaSettings];

/**
 * History, custom tables and settings for apnea training, always current.
 * By default also collects a session that finished while the app was closed;
 * pass `collect: false` on screens that should leave that to the session summary.
 */
export const useApneaData = ({ collect = true }: { collect?: boolean } = {}) => {
    const load = useCallback(async () => {
        if (collect) {
            await collectFinishedSession().catch(error => logger.warn('Could not collect apnea session', error));
        }
        return Promise.all([getApneaRecords(), getCustomTables(), getApneaSettings()]);
    }, [collect]);
    const { data, setData, loaded, reload } = useFocusData(load, EMPTY, { watch: WATCH });
    const [records, tables, settings] = data;

    /** Saves a settings change, updating the screen at once. */
    const changeSettings = useCallback(
        async (change: Partial<ApneaSettings>) => {
            setData(([r, t, s]) => [r, t, { ...s, ...change }]);
            const saved = await updateApneaSettings(change);
            return saved !== null;
        },
        [setData],
    );

    return { records, tables, settings, loaded, reload, changeSettings };
};
