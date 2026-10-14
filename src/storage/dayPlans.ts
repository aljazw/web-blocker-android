import { DayPlan, OneOffTask, PlanPrefs } from '../types/types';
import { DEFAULT_HABIT_ICON } from '../constants/habitIcons';
import { IconName, isIconName } from '../components/Icon';
import { DATE_KEY, KEYS, clampInt, isNumber, isString, readList, readObject, updateList, writeJson } from './core';
import { DEFAULT_TASK_MINUTES, MAX_TASK_MINUTES } from './habits';

/** Only recent days are kept. */
const MAX_DAYS = 60;

const byDate = (a: DayPlan, b: DayPlan) => a.date.localeCompare(b.date);

export const emptyDay = (date: string): DayPlan => ({ date, order: [], oneOffs: [], finished: {}, skipped: [] });

const toOneOff = (v: any): OneOffTask | null =>
    v && isString(v.id) && isString(v.title)
        ? {
              id: v.id,
              title: v.title,
              icon: isIconName(v.icon) ? v.icon : DEFAULT_HABIT_ICON,
              duration: clampInt(v.duration, 1, MAX_TASK_MINUTES, DEFAULT_TASK_MINUTES),
          }
        : null;

const toDayPlan = (v: any): DayPlan | null => {
    if (!v || typeof v.date !== 'string' || !DATE_KEY.test(v.date)) {
        return null;
    }
    const finished: Record<string, number> = {};
    if (v.finished && typeof v.finished === 'object') {
        for (const [id, at] of Object.entries(v.finished)) {
            if (isNumber(at)) {
                finished[id] = clampInt(at, 0, 2 * 1440, 0);
            }
        }
    }
    return {
        date: v.date,
        order: Array.isArray(v.order) ? v.order.filter(isString) : [],
        oneOffs: Array.isArray(v.oneOffs)
            ? v.oneOffs.map(toOneOff).filter((t: OneOffTask | null): t is OneOffTask => t !== null)
            : [],
        finished,
        skipped: Array.isArray(v.skipped) ? v.skipped.filter(isString) : [],
    };
};

/** Stored days, oldest first. */
export const getDays = (): Promise<DayPlan[]> => readList(KEYS.days, toDayPlan);

/** The stored state of `date`, or an empty day. */
export const getDay = async (date: string): Promise<DayPlan> =>
    (await getDays()).find(d => d.date === date) ?? emptyDay(date);

/** Applies `change` to the day (an empty one if none is stored), inside the write queue. */
export const updateDay = (date: string, change: (day: DayPlan) => DayPlan): Promise<boolean> =>
    updateList(KEYS.days, toDayPlan, list => {
        const day = change(list.find(d => d.date === date) ?? emptyDay(date));
        return [...list.filter(d => d.date !== date), day].sort(byDate).slice(-MAX_DAYS);
    });

/** A time-window block from before the routine; only read to move it over. */
export interface LegacyBlock {
    title: string;
    icon: IconName;
    start: number;
    end: number;
    habitId?: string;
    once?: boolean;
    shift?: number;
}

const toLegacyPlan = (v: any): { date: string; blocks: LegacyBlock[] } | null =>
    v && typeof v.date === 'string' && Array.isArray(v.blocks)
        ? {
              date: v.date,
              blocks: v.blocks
                  .filter((b: any) => b && isString(b.title) && isNumber(b.start) && isNumber(b.end) && b.end > b.start)
                  .map((b: any) => ({ ...b, icon: isIconName(b.icon) ? b.icon : DEFAULT_HABIT_ICON })),
          }
        : null;

export const getLegacyPlans = () => readList(KEYS.dayPlans, toLegacyPlan);

export const DEFAULT_PLAN_PREFS: PlanPrefs = { reminders: true, nudges: true };

const toPlanPrefs = (v: any): PlanPrefs => ({ reminders: v.reminders !== false, nudges: v.nudges !== false });

export const getPlanPrefs = (): Promise<PlanPrefs> => readObject(KEYS.planPrefs, toPlanPrefs);

export const setPlanPrefs = (prefs: PlanPrefs): Promise<boolean> => writeJson(KEYS.planPrefs, prefs);

/** Which in-app check-ins were already shown today, so each one appears at most once. */
export interface PlanNudgeLog {
    date: string;
    shown: string[];
    /** Epoch millis of the last pop-up. */
    lastAt: number;
}

const toNudgeLog = (v: any): PlanNudgeLog => ({
    date: typeof v.date === 'string' ? v.date : '',
    shown: Array.isArray(v.shown) ? v.shown.filter(isString) : [],
    lastAt: isNumber(v.lastAt) ? v.lastAt : 0,
});

export const getPlanNudgeLog = (): Promise<PlanNudgeLog> => readObject(KEYS.planNudges, toNudgeLog);

export const setPlanNudgeLog = (log: PlanNudgeLog): Promise<boolean> => writeJson(KEYS.planNudges, log);
