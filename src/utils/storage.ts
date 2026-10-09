import { NativeModules } from 'react-native';
import {
    ApneaRecord,
    ApneaSettings,
    BlockedAppData,
    BlockedWebsitesData,
    CustomTable,
    DayPlan,
    Exercise,
    Habit,
    PlanBlock,
    PlanPrefs,
    SleepSchedule,
    TableParams,
    TableRound,
    Workout,
    WorkoutCues,
    WorkoutRecord,
    WorkoutSession,
} from '../types/types';
import { DEFAULT_HABIT_ICON, habitIconFrom } from '../constants/habitIcons';
import { isIconName } from '../components/Icon';
import { DEFAULT_TABLE_PARAMS, isApneaKind, normalizeParams } from './apnea';
import { DEFAULT_SLEEP_SCHEDULE, isValidTime } from './sleep';

const { SharedStorage } = NativeModules;

/**
 * Keys shared with the native side (BlockAccessibilityService, DnsVpnService,
 * GamanScreen read the same "BlockedPrefs" SharedPreferences).
 */
const KEYS = {
    websites: '@blocked_websites',
    apps: '@blocked_apps',
    habits: '@habits',
    apneaRecords: '@apnea_records',
    apneaTables: '@apnea_tables',
    apneaSettings: '@apnea_settings',
    hasSeenWelcome: '@has_seen_welcome',
    notificationScheduled: '@notification_scheduled',
    darkMode: '@is_dark_mode',
    passphrase: '@is_passphrase',
    accent: '@accent_color',
    workouts: '@workouts',
    workoutRecords: '@workout_records',
    workoutSession: '@workout_session',
    workoutCues: '@workout_cues',
    sleepSchedule: '@sleep_schedule',
    sleepDismissedUntil: '@sleep_dismissed_until',
    dayPlans: '@day_plans',
    planPrefs: '@plan_prefs',
    planNudges: '@plan_nudges',
} as const;

// ---- Low-level helpers ------------------------------------------------------

/**
 * Every read-modify-write runs one after another through this queue, so two
 * quick actions (e.g. adding two sites, or a double tap) can never read the
 * same old list and overwrite each other's change.
 */
let queue: Promise<unknown> = Promise.resolve();
const serialized = <T>(task: () => Promise<T>): Promise<T> => {
    const run = queue.then(task, task);
    queue = run.catch(() => undefined);
    return run;
};

/** Parses stored JSON; damaged data is treated as missing instead of crashing the app. */
const parseJson = (raw: string | null | undefined): unknown => {
    if (!raw) {
        return null;
    }
    try {
        return JSON.parse(raw);
    } catch {
        return null;
    }
};

const readBool = async (key: string): Promise<boolean | null> => {
    const value = await SharedStorage.getItem(key);
    if (value === 'true') {
        return true;
    }
    if (value === 'false') {
        return false;
    }
    return null;
};

const writeJson = async (key: string, value: unknown): Promise<boolean> =>
    (await SharedStorage.setItem(key, JSON.stringify(value))) === true;

const isString = (v: unknown): v is string => typeof v === 'string' && v.length > 0;

/** Keeps only well-formed entries; fills in `visible` for old data that lacked it. */
const toWebsite = (v: any): BlockedWebsitesData | null =>
    v && isString(v.websiteUrl) && typeof v.days === 'string' && typeof v.time === 'string'
        ? { websiteUrl: v.websiteUrl, days: v.days, time: v.time, visible: v.visible !== false }
        : null;

const toApp = (v: any): BlockedAppData | null =>
    v && isString(v.packageName) && typeof v.days === 'string' && typeof v.time === 'string'
        ? {
              packageName: v.packageName,
              appName: isString(v.appName) ? v.appName : v.packageName,
              days: v.days,
              time: v.time,
              visible: v.visible !== false,
          }
        : null;

const readList = async <T>(key: string, toItem: (v: any) => T | null): Promise<T[]> => {
    const parsed = parseJson(await SharedStorage.getItem(key));
    if (!Array.isArray(parsed)) {
        return [];
    }
    return parsed.map(toItem).filter((item): item is T => item !== null);
};

/** Read the list, apply `change`, write it back — all inside the queue. */
const updateList = <T>(key: string, toItem: (v: any) => T | null, change: (list: T[]) => T[]) =>
    serialized(async () => {
        try {
            const list = await readList(key, toItem);
            return await writeJson(key, change(list));
        } catch {
            return false;
        }
    });

// ---- Blocked websites -------------------------------------------------------

export const getBlockedWebsites = async (): Promise<BlockedWebsitesData[]> => {
    try {
        return await readList(KEYS.websites, toWebsite);
    } catch {
        throw new Error('Failed to get blocked websites');
    }
};

export const isWebsiteBlocked = async (url: string): Promise<boolean> => {
    try {
        return (await getBlockedWebsites()).some(site => site.websiteUrl === url);
    } catch {
        return false;
    }
};

/** Adds a site. Adding one that's already on the list is a no-op that still succeeds. */
export const addBlockedWebsite = (entry: BlockedWebsitesData): Promise<boolean> =>
    updateList(KEYS.websites, toWebsite, list =>
        list.some(site => site.websiteUrl === entry.websiteUrl) ? list : [...list, entry],
    );

export const deleteBlockedWebsite = (url: string): Promise<boolean> =>
    updateList(KEYS.websites, toWebsite, list => list.filter(site => site.websiteUrl !== url));

export const hideBlockedWebsite = (url: string): Promise<boolean> =>
    updateList(KEYS.websites, toWebsite, list =>
        list.map(site => (site.websiteUrl === url ? { ...site, visible: false } : site)),
    );

// ---- Blocked apps -----------------------------------------------------------

export const getBlockedApps = async (): Promise<BlockedAppData[]> => {
    try {
        return await readList(KEYS.apps, toApp);
    } catch {
        throw new Error('Failed to get blocked apps');
    }
};

export const isAppBlocked = async (packageName: string): Promise<boolean> => {
    try {
        return (await getBlockedApps()).some(app => app.packageName === packageName);
    } catch {
        return false;
    }
};

/** Adds an app. Adding one that's already on the list is a no-op that still succeeds. */
export const addBlockedApp = (entry: BlockedAppData): Promise<boolean> =>
    updateList(KEYS.apps, toApp, list =>
        list.some(app => app.packageName === entry.packageName) ? list : [...list, entry],
    );

export const deleteBlockedApp = (packageName: string): Promise<boolean> =>
    updateList(KEYS.apps, toApp, list => list.filter(app => app.packageName !== packageName));

export const hideBlockedApp = (packageName: string): Promise<boolean> =>
    updateList(KEYS.apps, toApp, list =>
        list.map(app => (app.packageName === packageName ? { ...app, visible: false } : app)),
    );

// ---- Habits -----------------------------------------------------------------

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^\d{2}:\d{2}$/;

const toHabit = (v: any): Habit | null => {
    if (!v || !isString(v.id) || !isString(v.title) || !Array.isArray(v.days) || v.days.length !== 7) {
        return null;
    }
    return {
        id: v.id,
        title: v.title,
        icon: habitIconFrom(v.icon, v.emoji),
        days: v.days.map((d: unknown) => d === true),
        reminder: typeof v.reminder === 'string' && TIME.test(v.reminder) ? v.reminder : null,
        createdAt: typeof v.createdAt === 'string' && DATE_KEY.test(v.createdAt) ? v.createdAt : '1970-01-01',
        completions: Array.isArray(v.completions)
            ? [
                  ...new Set<string>(v.completions.filter((k: unknown) => typeof k === 'string' && DATE_KEY.test(k))),
              ].sort()
            : [],
        ...(v.link === 'apnea' || v.link === 'workout' ? { link: v.link } : {}),
    };
};

export const getHabits = async (): Promise<Habit[]> => {
    try {
        return await readList(KEYS.habits, toHabit);
    } catch {
        throw new Error('Failed to get habits');
    }
};

/** Inserts the habit, or replaces the one with the same id. */
export const saveHabit = (habit: Habit): Promise<boolean> =>
    updateList(KEYS.habits, toHabit, list =>
        list.some(h => h.id === habit.id) ? list.map(h => (h.id === habit.id ? habit : h)) : [...list, habit],
    );

/** Applies `change` to the stored habit (by id) inside the write queue, so check-ins never race. */
export const updateHabit = (id: string, change: (habit: Habit) => Habit): Promise<boolean> =>
    updateList(KEYS.habits, toHabit, list => list.map(h => (h.id === id ? change(h) : h)));

export const deleteHabit = (id: string): Promise<boolean> =>
    updateList(KEYS.habits, toHabit, list => list.filter(h => h.id !== id));

// ---- Apnea training ---------------------------------------------------------

/** History is capped so storage stays small; the oldest records go first. */
const MAX_APNEA_RECORDS = 1000;

const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const numbers = (v: unknown): number[] => (Array.isArray(v) ? v.filter(isNumber) : []);

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

export const getApneaRecords = (): Promise<ApneaRecord[]> => readList(KEYS.apneaRecords, toApneaRecord);

/** Adds a record; one with the same id is ignored, so a result can never be saved twice. */
export const addApneaRecord = (record: ApneaRecord): Promise<boolean> =>
    updateList(KEYS.apneaRecords, toApneaRecord, list =>
        list.some(r => r.id === record.id)
            ? list
            : [...list, record].sort((a, b) => a.startedAt - b.startedAt).slice(-MAX_APNEA_RECORDS),
    );

export const deleteApneaRecord = (id: string): Promise<boolean> =>
    updateList(KEYS.apneaRecords, toApneaRecord, list => list.filter(r => r.id !== id));

export const clearApneaRecords = (): Promise<boolean> => updateList(KEYS.apneaRecords, toApneaRecord, () => []);

export const getCustomTables = (): Promise<CustomTable[]> => readList(KEYS.apneaTables, toCustomTable);

/** Inserts the table, or replaces the one with the same id. */
export const saveCustomTable = (table: CustomTable): Promise<boolean> =>
    updateList(KEYS.apneaTables, toCustomTable, list =>
        list.some(t => t.id === table.id) ? list.map(t => (t.id === table.id ? table : t)) : [...list, table],
    );

export const deleteCustomTable = (id: string): Promise<boolean> =>
    updateList(KEYS.apneaTables, toCustomTable, list => list.filter(t => t.id !== id));

export const getApneaSettings = async (): Promise<ApneaSettings> => {
    const v: any = parseJson(await SharedStorage.getItem(KEYS.apneaSettings)) ?? {};
    const d = DEFAULT_APNEA_SETTINGS;
    const bool = (value: unknown, fallback: boolean) => (typeof value === 'boolean' ? value : fallback);
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

// ---- Workouts -----------------------------------------------------------------

const MAX_WORKOUT_RECORDS = 1000;
const WORKOUT_PHASES = ['ready', 'work', 'rest', 'done'];

const clampInt = (v: unknown, min: number, max: number, fallback: number) =>
    isNumber(v) ? Math.min(max, Math.max(min, Math.round(v))) : fallback;

const toExercise = (v: any): Exercise | null =>
    v && isString(v.id) && isString(v.name)
        ? {
              id: v.id,
              name: v.name,
              mode: v.mode === 'time' ? 'time' : 'reps',
              sets: clampInt(v.sets, 1, 10, 3),
              reps: clampInt(v.reps, 1, 200, 10),
              seconds: clampInt(v.seconds, 5, 900, 45),
              rest: clampInt(v.rest, 0, 600, 60),
          }
        : null;

const toExercises = (v: unknown): Exercise[] =>
    Array.isArray(v) ? v.map(toExercise).filter((e): e is Exercise => e !== null) : [];

const toWorkout = (v: any): Workout | null =>
    v && isString(v.id) && isString(v.name) ? { id: v.id, name: v.name, exercises: toExercises(v.exercises) } : null;

const toWorkoutRecord = (v: any): WorkoutRecord | null =>
    v && isString(v.id) && isNumber(v.startedAt) && isNumber(v.setsDone) && isNumber(v.setsTotal)
        ? {
              id: v.id,
              workoutId: isString(v.workoutId) ? v.workoutId : '',
              title: isString(v.title) ? v.title : 'Workout',
              startedAt: v.startedAt,
              endedAt: isNumber(v.endedAt) ? v.endedAt : v.startedAt,
              setsDone: v.setsDone,
              setsTotal: v.setsTotal,
              completed: v.completed === true,
          }
        : null;

export const getWorkouts = (): Promise<Workout[]> => readList(KEYS.workouts, toWorkout);

/** Inserts the workout, or replaces the one with the same id. */
export const saveWorkout = (workout: Workout): Promise<boolean> =>
    updateList(KEYS.workouts, toWorkout, list =>
        list.some(w => w.id === workout.id) ? list.map(w => (w.id === workout.id ? workout : w)) : [...list, workout],
    );

export const deleteWorkout = (id: string): Promise<boolean> =>
    updateList(KEYS.workouts, toWorkout, list => list.filter(w => w.id !== id));

export const getWorkoutRecords = (): Promise<WorkoutRecord[]> => readList(KEYS.workoutRecords, toWorkoutRecord);

/** Adds a record; one with the same id is ignored, so a workout can never be saved twice. */
export const addWorkoutRecord = (record: WorkoutRecord): Promise<boolean> =>
    updateList(KEYS.workoutRecords, toWorkoutRecord, list =>
        list.some(r => r.id === record.id)
            ? list
            : [...list, record].sort((a, b) => a.startedAt - b.startedAt).slice(-MAX_WORKOUT_RECORDS),
    );

export const deleteWorkoutRecord = (id: string): Promise<boolean> =>
    updateList(KEYS.workoutRecords, toWorkoutRecord, list => list.filter(r => r.id !== id));

/** The workout in progress, or null. */
export const getWorkoutSession = async (): Promise<WorkoutSession | null> => {
    const v: any = parseJson(await SharedStorage.getItem(KEYS.workoutSession));
    const exercises = toExercises(v?.exercises);
    if (!v || !isString(v.id) || !exercises.length || !WORKOUT_PHASES.includes(v.phase)) {
        return null;
    }
    const exercise = clampInt(v.exercise, 0, exercises.length - 1, 0);
    return {
        id: v.id,
        workoutId: isString(v.workoutId) ? v.workoutId : '',
        title: isString(v.title) ? v.title : 'Workout',
        exercises,
        exercise,
        set: clampInt(v.set, 0, exercises[exercise].sets - 1, 0),
        phase: v.phase,
        phaseStartedAt: isNumber(v.phaseStartedAt) ? v.phaseStartedAt : Date.now(),
        startedAt: isNumber(v.startedAt) ? v.startedAt : Date.now(),
        endedAt: isNumber(v.endedAt) ? v.endedAt : 0,
        setsDone: clampInt(v.setsDone, 0, 10000, 0),
        endedEarly: v.endedEarly === true,
    };
};

/** Saves the workout in progress; null clears it. */
export const setWorkoutSession = async (session: WorkoutSession | null): Promise<boolean> =>
    session ? writeJson(KEYS.workoutSession, session) : (await SharedStorage.setItem(KEYS.workoutSession, '')) === true;

export const getWorkoutCues = async (): Promise<WorkoutCues> => {
    const v: any = parseJson(await SharedStorage.getItem(KEYS.workoutCues)) ?? {};
    return { sound: v.sound !== false, vibration: v.vibration !== false };
};

export const setWorkoutCues = (cues: WorkoutCues): Promise<boolean> => writeJson(KEYS.workoutCues, cues);

// ---- Sleep time -------------------------------------------------------------

export const getSleepSchedule = async (): Promise<SleepSchedule> => {
    const v: any = parseJson(await SharedStorage.getItem(KEYS.sleepSchedule)) ?? {};
    const d = DEFAULT_SLEEP_SCHEDULE;
    return {
        enabled: v.enabled === true,
        bedtime: typeof v.bedtime === 'string' && isValidTime(v.bedtime) ? v.bedtime : d.bedtime,
        wake: typeof v.wake === 'string' && isValidTime(v.wake) ? v.wake : d.wake,
    };
};

/**
 * Saves the schedule and clears any "turned off tonight" pause, so a schedule
 * saved during the night takes effect right away.
 */
export const setSleepSchedule = (schedule: SleepSchedule): Promise<boolean> =>
    serialized(async () => {
        try {
            await SharedStorage.setItem(KEYS.sleepDismissedUntil, '0');
            return await writeJson(KEYS.sleepSchedule, schedule);
        } catch {
            return false;
        }
    });

/** Epoch millis until which sleep time is turned off (set by the native sleep page), or 0. */
export const getSleepDismissedUntil = async (): Promise<number> => {
    const value = Number(await SharedStorage.getItem(KEYS.sleepDismissedUntil));
    return Number.isFinite(value) ? value : 0;
};

// ---- Day plan ---------------------------------------------------------------

/** Only recent days are kept; a new day is always copied from the latest one. */
const MAX_DAY_PLANS = 60;

const toPlanBlock = (v: any): PlanBlock | null => {
    if (!v || !isString(v.id) || !isString(v.title) || !isNumber(v.start) || !isNumber(v.end)) {
        return null;
    }
    const start = clampInt(v.start, 0, 1435, 0);
    const end = clampInt(v.end, start + 5, 1440, start + 30);
    return {
        id: v.id,
        title: v.title,
        icon: isIconName(v.icon) ? v.icon : DEFAULT_HABIT_ICON,
        start,
        end,
        ...(isString(v.habitId) ? { habitId: v.habitId } : {}),
        ...(v.once === true ? { once: true } : {}),
        ...(v.done === true ? { done: true } : {}),
    };
};

const toDayPlan = (v: any): DayPlan | null =>
    v && typeof v.date === 'string' && DATE_KEY.test(v.date) && Array.isArray(v.blocks)
        ? {
              date: v.date,
              blocks: v.blocks.map(toPlanBlock).filter((b: PlanBlock | null): b is PlanBlock => b !== null),
          }
        : null;

/** Stored plans, oldest first. */
export const getDayPlans = async (): Promise<DayPlan[]> =>
    (await readList(KEYS.dayPlans, toDayPlan)).sort((a, b) => a.date.localeCompare(b.date));

/** Inserts the day's plan, or replaces the stored one for the same date. */
export const saveDayPlan = (plan: DayPlan): Promise<boolean> =>
    updateList(KEYS.dayPlans, toDayPlan, list =>
        [...list.filter(p => p.date !== plan.date), plan]
            .sort((a, b) => a.date.localeCompare(b.date))
            .slice(-MAX_DAY_PLANS),
    );

/** Applies `change` to the stored plan for `date` (inside the write queue); no-op if there is none. */
export const updateDayPlan = (date: string, change: (plan: DayPlan) => DayPlan): Promise<boolean> =>
    updateList(KEYS.dayPlans, toDayPlan, list => list.map(p => (p.date === date ? change(p) : p)));

export const DEFAULT_PLAN_PREFS: PlanPrefs = { reminders: true, nudges: true };

export const getPlanPrefs = async (): Promise<PlanPrefs> => {
    const v: any = parseJson(await SharedStorage.getItem(KEYS.planPrefs)) ?? {};
    return { reminders: v.reminders !== false, nudges: v.nudges !== false };
};

export const setPlanPrefs = (prefs: PlanPrefs): Promise<boolean> => writeJson(KEYS.planPrefs, prefs);

/** Which in-app pop-ups were already shown today, so each one appears at most once. */
export interface PlanNudgeLog {
    date: string;
    shown: string[];
    /** Epoch millis of the last pop-up. */
    lastAt: number;
}

export const getPlanNudgeLog = async (): Promise<PlanNudgeLog> => {
    const v: any = parseJson(await SharedStorage.getItem(KEYS.planNudges)) ?? {};
    return {
        date: typeof v.date === 'string' ? v.date : '',
        shown: Array.isArray(v.shown) ? v.shown.filter(isString) : [],
        lastAt: isNumber(v.lastAt) ? v.lastAt : 0,
    };
};

export const setPlanNudgeLog = (log: PlanNudgeLog): Promise<boolean> => writeJson(KEYS.planNudges, log);

// ---- Preferences ------------------------------------------------------------

export const hasUserSeenWelcome = async (): Promise<boolean> => (await readBool(KEYS.hasSeenWelcome)) === true;

export const setUserHasSeenWelcome = async (hasSeenWelcome: boolean): Promise<void> => {
    await writeJson(KEYS.hasSeenWelcome, hasSeenWelcome);
};

export const isNotificationScheduled = async (): Promise<boolean> =>
    (await readBool(KEYS.notificationScheduled)) === true;

export const setNotificationScheduled = async (isScheduled: boolean): Promise<void> => {
    await writeJson(KEYS.notificationScheduled, isScheduled);
};

export const getThemePreference = (): Promise<boolean | null> => readBool(KEYS.darkMode);

export const setThemePreference = async (isDarkMode: boolean): Promise<void> => {
    await writeJson(KEYS.darkMode, isDarkMode);
};

export const getPassphrasePreference = (): Promise<boolean | null> => readBool(KEYS.passphrase);

export const setPassphrasePreference = async (isPassphrase: boolean): Promise<void> => {
    await writeJson(KEYS.passphrase, isPassphrase);
};

export const getAccentPreference = async (): Promise<string | null> => {
    const value = parseJson(await SharedStorage.getItem(KEYS.accent));
    return typeof value === 'string' ? value : null;
};

export const setAccentPreference = async (accent: string): Promise<void> => {
    await writeJson(KEYS.accent, accent);
};
