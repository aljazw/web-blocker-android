import { DayPlan, PlanBlock, PlanPrefs } from '../types/types';
import { DEFAULT_HABIT_ICON } from '../constants/habitIcons';
import { isIconName } from '../components/Icon';
import { DATE_KEY, KEYS, clampInt, isNumber, isString, readList, readObject, updateList, writeJson } from './core';

/** Only recent days are kept; a new day is always copied from the latest one. */
const MAX_DAY_PLANS = 60;

const byDate = (a: DayPlan, b: DayPlan) => a.date.localeCompare(b.date);

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
        ...(isNumber(v.shift) && v.shift !== 0 ? { shift: clampInt(v.shift, -1440, 1440, 0) } : {}),
    };
};

const toDayPlan = (v: any): DayPlan | null =>
    v && typeof v.date === 'string' && DATE_KEY.test(v.date) && Array.isArray(v.blocks)
        ? {
              date: v.date,
              blocks: v.blocks.map(toPlanBlock).filter((b: PlanBlock | null): b is PlanBlock => b !== null),
          }
        : null;

/** Stored plans, oldest first (saving keeps them sorted). */
export const getDayPlans = async (): Promise<DayPlan[]> => readList(KEYS.dayPlans, toDayPlan);

/** Inserts the day's plan, or replaces the stored one for the same date. */
export const saveDayPlan = (plan: DayPlan): Promise<boolean> =>
    updateList(KEYS.dayPlans, toDayPlan, list =>
        [...list.filter(p => p.date !== plan.date), plan].sort(byDate).slice(-MAX_DAY_PLANS),
    );

/** Applies `change` to the stored plan for `date` (inside the write queue); no-op if there is none. */
export const updateDayPlan = (date: string, change: (plan: DayPlan) => DayPlan): Promise<boolean> =>
    updateList(KEYS.dayPlans, toDayPlan, list => list.map(p => (p.date === date ? change(p) : p)));

export const DEFAULT_PLAN_PREFS: PlanPrefs = { reminders: true, nudges: true };

const toPlanPrefs = (v: any): PlanPrefs => ({ reminders: v.reminders !== false, nudges: v.nudges !== false });

export const getPlanPrefs = (): Promise<PlanPrefs> => readObject(KEYS.planPrefs, toPlanPrefs);

export const setPlanPrefs = (prefs: PlanPrefs): Promise<boolean> => writeJson(KEYS.planPrefs, prefs);

/** Which in-app pop-ups were already shown today, so each one appears at most once. */
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
