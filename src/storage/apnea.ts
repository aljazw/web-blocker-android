import { ApneaRecord, ApneaSettings, CustomTable, TableParams, TableRound } from '../types/types';
import { DEFAULT_TABLE_PARAMS, isApneaKind, normalizeParams } from '../utils/apnea';
import {
    KEYS,
    addRecord,
    isNumber,
    isString,
    numbers,
    readList,
    readObject,
    serialized,
    updateList,
    upsertById,
    withoutId,
    writeJson,
} from './core';

/** History is capped so storage stays small; the oldest records go first. */
const MAX_APNEA_RECORDS = 1000;

const toApneaRecord = (v: any): ApneaRecord | null => {
    if (!v || !isString(v.id) || !isApneaKind(v.kind) || !isNumber(v.startedAt)) {
        return null;
    }
    const holds = numbers(v.holds);
    return {
        id: v.id,
        kind: v.kind,
        title: isString(v.title) ? v.title : v.kind,
        startedAt: v.startedAt,
        endedAt: isNumber(v.endedAt) ? v.endedAt : v.startedAt,
        completed: v.completed === true,
        holds,
        targets: numbers(v.targets),
        contractions: holds.map((_, i) => numbers(Array.isArray(v.contractions) ? v.contractions[i] : null)),
        planned: isNumber(v.planned) ? v.planned : holds.length,
        ...(v.manual === true ? { manual: true } : {}),
    };
};

const toRound = (v: any): TableRound | null =>
    v && isNumber(v.breathe) && isNumber(v.hold) && v.breathe >= 0 && v.hold > 0
        ? { breathe: Math.round(v.breathe), hold: Math.round(v.hold) }
        : null;

const toCustomTable = (v: any): CustomTable | null => {
    if (!v || !isString(v.id) || !Array.isArray(v.rounds)) {
        return null;
    }
    const rounds = v.rounds.map(toRound).filter((r: TableRound | null): r is TableRound => r !== null);
    return rounds.length ? { id: v.id, name: isString(v.name) ? v.name : 'Custom table', rounds } : null;
};

const toTableParams = (v: any, fallback: TableParams): TableParams =>
    v && isNumber(v.hold) && isNumber(v.breathe) && isNumber(v.step) && isNumber(v.rounds)
        ? normalizeParams({ hold: v.hold, breathe: v.breathe, step: v.step, rounds: v.rounds })
        : fallback;

export const DEFAULT_APNEA_SETTINGS: ApneaSettings = {
    sound: true,
    vibration: true,
    holdPulse: true,
    breatheUp: 120,
    co2: DEFAULT_TABLE_PARAMS.co2,
    o2: DEFAULT_TABLE_PARAMS.o2,
    safetyAccepted: false,
};

const bool = (value: unknown, fallback: boolean) => (typeof value === 'boolean' ? value : fallback);

const toApneaSettings = (v: any): ApneaSettings => {
    const d = DEFAULT_APNEA_SETTINGS;
    return {
        sound: bool(v.sound, d.sound),
        vibration: bool(v.vibration, d.vibration),
        holdPulse: bool(v.holdPulse, d.holdPulse),
        breatheUp: isNumber(v.breatheUp) && v.breatheUp >= 0 && v.breatheUp <= 600 ? v.breatheUp : d.breatheUp,
        co2: toTableParams(v.co2, d.co2),
        o2: toTableParams(v.o2, d.o2),
        safetyAccepted: bool(v.safetyAccepted, d.safetyAccepted),
    };
};

export const getApneaRecords = (): Promise<ApneaRecord[]> => readList(KEYS.apneaRecords, toApneaRecord);

/** Adds a record; one with the same id is ignored, so a result can never be saved twice. */
export const addApneaRecord = (record: ApneaRecord): Promise<boolean> =>
    updateList(KEYS.apneaRecords, toApneaRecord, list => addRecord(list, record, MAX_APNEA_RECORDS));

export const deleteApneaRecord = (id: string): Promise<boolean> =>
    updateList(KEYS.apneaRecords, toApneaRecord, list => withoutId(list, id));

export const clearApneaRecords = (): Promise<boolean> => updateList(KEYS.apneaRecords, toApneaRecord, () => []);

export const getCustomTables = (): Promise<CustomTable[]> => readList(KEYS.apneaTables, toCustomTable);

/** Inserts the table, or replaces the one with the same id. */
export const saveCustomTable = (table: CustomTable): Promise<boolean> =>
    updateList(KEYS.apneaTables, toCustomTable, list => upsertById(list, table));

export const deleteCustomTable = (id: string): Promise<boolean> =>
    updateList(KEYS.apneaTables, toCustomTable, list => withoutId(list, id));

export const getApneaSettings = (): Promise<ApneaSettings> => readObject(KEYS.apneaSettings, toApneaSettings);

/** Merges `change` into the stored settings (inside the write queue) and returns the result. */
export const updateApneaSettings = (change: Partial<ApneaSettings>): Promise<ApneaSettings | null> =>
    serialized(async () => {
        try {
            const next = { ...(await getApneaSettings()), ...change };
            return (await writeJson(KEYS.apneaSettings, next)) ? next : null;
        } catch {
            return null;
        }
    });
