/** Loading, saving and notifications for the day plan. Pure plan logic lives in dayPlan.ts. */
import notifee, { AndroidImportance, RepeatFrequency, TriggerType } from '@notifee/react-native';
import { DayPlan, PlanBlock } from '../types/types';
import { addDays, fromDateKey, toDateKey } from './dates';
import { markDone } from './habits';
import { dismissTodaysReminder } from './habitReminders';
import {
    blockTimes,
    copyPlan,
    formatMinutes,
    isBlockDone,
    motivationFor,
    parseMinutes,
    sortBlocks,
    timestampOf,
    visibleBlocks,
} from './dayPlan';
import {
    getDayPlans,
    getHabits,
    getPlanPrefs,
    getSleepSchedule,
    saveDayPlan,
    updateDayPlan,
    updateHabit,
} from './storage';
import { logger } from './logger';

export interface LoadedPlan {
    plan: DayPlan;
    /** False for a day that hasn't been saved yet (a copy of the latest earlier plan, or empty). */
    stored: boolean;
}

/**
 * The plan for `dateKey`. A day without its own plan starts as a copy of the
 * latest earlier one, so each day is edited from yesterday instead of built
 * from scratch. Today's copy is saved right away (check-offs need somewhere to
 * live); a future day's copy is only saved once it's edited, so it keeps
 * following today's changes until then.
 */
export const loadDayPlan = async (dateKey: string): Promise<LoadedPlan> => {
    const plans = await getDayPlans();
    const own = plans.find(p => p.date === dateKey);
    if (own) {
        return { plan: { ...own, blocks: sortBlocks(own.blocks) }, stored: true };
    }
    const previous = plans.filter(p => p.date < dateKey).pop();
    const plan = previous ? copyPlan(previous, dateKey) : { date: dateKey, blocks: [] };
    if (previous && dateKey <= toDateKey(new Date()) && (await saveDayPlan(plan))) {
        return { plan, stored: true };
    }
    return { plan, stored: false };
};

// ---- Change events -------------------------------------------------------------

type Listener = () => void;
const listeners = new Set<Listener>();

/** Called after the plan (or a habit) changes outside the screen showing it, e.g. from a pop-up. */
export const onPlanChanged = (listener: Listener): (() => void) => {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
};

export const notifyPlanChanged = () => listeners.forEach(listener => listener());

/** Saves the plan and refreshes the block reminders. */
export const persistDayPlan = async (plan: DayPlan): Promise<boolean> => {
    const ok = await saveDayPlan({ ...plan, blocks: sortBlocks(plan.blocks) });
    if (ok) {
        syncPlanReminders();
    }
    return ok;
};

/** Checks a block off on `dateKey`: its linked habit, or the block itself. */
export const completeBlock = async (dateKey: string, block: PlanBlock): Promise<boolean> => {
    let ok: boolean;
    if (block.habitId) {
        const habitId = block.habitId;
        ok = await updateHabit(habitId, habit => markDone(habit, fromDateKey(dateKey)));
        if (ok) {
            const habit = (await getHabits()).find(h => h.id === habitId);
            if (habit) {
                dismissTodaysReminder(habit);
            }
        }
    } else {
        ok = await updateDayPlan(dateKey, plan => ({
            ...plan,
            blocks: plan.blocks.map(b => (b.id === block.id ? { ...b, done: true } : b)),
        }));
    }
    if (ok) {
        syncPlanReminders();
        notifyPlanChanged();
    }
    return ok;
};

/** Replaces (or adds) one block in the day's plan. */
export const upsertBlock = async (dateKey: string, block: PlanBlock): Promise<boolean> => {
    const { plan } = await loadDayPlan(dateKey);
    const exists = plan.blocks.some(b => b.id === block.id);
    return persistDayPlan({
        ...plan,
        blocks: exists ? plan.blocks.map(b => (b.id === block.id ? block : b)) : [...plan.blocks, block],
    });
};

export const removeBlock = async (dateKey: string, blockId: string): Promise<boolean> => {
    const { plan } = await loadDayPlan(dateKey);
    return persistDayPlan({ ...plan, blocks: plan.blocks.filter(b => b.id !== blockId) });
};

// ---- Notifications ------------------------------------------------------------

const CHANNEL_ID = 'plan';
const ID_PREFIX = 'plan:';
const REVIEW_ID = `${ID_PREFIX}review`;
/** Evening "plan tomorrow" reminder: an hour before bedtime, or 21:00 without sleep time. */
const REVIEW_FALLBACK = 21 * 60;

const notification = (id: string, title: string, body: string) => ({
    id,
    title,
    body,
    android: {
        channelId: CHANNEL_ID,
        smallIcon: 'ic_stat_gaman',
        pressAction: { id: 'default' },
    },
});

let syncing: Promise<void> | null = null;
let again = false;

/**
 * Replaces all plan notifications: one when each remaining block of today and
 * tomorrow starts, plus a daily evening reminder to look over tomorrow. Runs
 * one at a time (a call during a sync queues one more run). Never throws.
 */
export const syncPlanReminders = (): Promise<void> => {
    if (syncing) {
        again = true;
        return syncing;
    }
    syncing = (async () => {
        do {
            again = false;
            await syncOnce();
        } while (again);
    })().finally(() => {
        syncing = null;
    });
    return syncing;
};

const syncOnce = async (): Promise<void> => {
    try {
        const ids = (await notifee.getTriggerNotificationIds()).filter(id => id.startsWith(ID_PREFIX));
        if (ids.length > 0) {
            await notifee.cancelTriggerNotifications(ids);
        }
        const prefs = await getPlanPrefs();
        if (!prefs.reminders) {
            return;
        }
        await notifee.createChannel({ id: CHANNEL_ID, name: 'Day plan', importance: AndroidImportance.HIGH });

        const [habits, sleep] = await Promise.all([getHabits(), getSleepSchedule()]);
        const now = Date.now();
        const today = new Date();

        for (const dateKey of [toDateKey(today), toDateKey(addDays(today, 1))]) {
            const { plan } = await loadDayPlan(dateKey);
            const blocks = visibleBlocks(plan, habits);
            await Promise.all(
                blocks.map((block, i) => {
                    const at = timestampOf(dateKey, block.start);
                    if (at <= now || isBlockDone(block, habits, dateKey)) {
                        return Promise.resolve();
                    }
                    const next = blocks.slice(i + 1).find(b => b.start >= block.end);
                    const body = `${motivationFor(dateKey + block.id)}${
                        next ? `\nNext: ${next.title} at ${formatMinutes(next.start)}` : ''
                    }`;
                    return notifee.createTriggerNotification(
                        notification(
                            `${ID_PREFIX}${dateKey}:${block.id}`,
                            `${block.title} · ${blockTimes(block)}`,
                            body,
                        ),
                        { type: TriggerType.TIMESTAMP, timestamp: at },
                    );
                }),
            );
        }

        const bed = sleep.enabled ? parseMinutes(sleep.bedtime) : null;
        const reviewAt = bed !== null && bed >= 60 ? bed - 60 : REVIEW_FALLBACK;
        let review = timestampOf(toDateKey(today), reviewAt);
        if (review <= now) {
            review = timestampOf(toDateKey(addDays(today, 1)), reviewAt);
        }
        await notifee.createTriggerNotification(
            notification(REVIEW_ID, 'Plan tomorrow', "Take a minute to look over tomorrow's plan."),
            { type: TriggerType.TIMESTAMP, timestamp: review, repeatFrequency: RepeatFrequency.DAILY },
        );
    } catch (error) {
        logger.warn('Could not schedule plan reminders', error);
    }
};
