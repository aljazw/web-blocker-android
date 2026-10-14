/** Loading, changing and notifications for the day plan. Pure plan logic lives in dayPlan.ts. */
import notifee, { AndroidImportance, TriggerType } from '@notifee/react-native';
import { DayPlan, Habit, OneOffTask, SleepSchedule } from '../types/types';
import { addDays, fromDateKey, newId, toDateKey } from './dates';
import { markDone } from './habits';
import {
    PlanTask,
    anchorsOf,
    dayTasks,
    formatDuration,
    formatMinutes,
    laterOrder,
    minutesNow,
    motivationFor,
    orderWith,
    routineFromLegacy,
    scheduleDay,
    timestampOf,
} from './dayPlan';
import {
    STORAGE_KEYS,
    getDay,
    getHabits,
    getLegacyPlans,
    getPlanPrefs,
    getSleepSchedule,
    onStorageChange,
    saveHabits,
    updateDay,
    updateHabit,
} from '../storage';
import { KEYS, readBool, writeJson } from '../storage/core';
import { logger } from './logger';

export interface LoadedDay {
    day: DayPlan;
    habits: Habit[];
    sleep: SleepSchedule;
}

export const loadDay = async (date: string): Promise<LoadedDay> => {
    const [day, habits, sleep] = await Promise.all([getDay(date), getHabits(), getSleepSchedule()]);
    return { day, habits, sleep };
};

const without = (finished: Record<string, number>, id: string): Record<string, number> =>
    Object.fromEntries(Object.entries(finished).filter(([key]) => key !== id));

/** Checks a task off at `at` (minutes after midnight): its habit too, for a routine task. */
export const completeTask = async (date: string, task: PlanTask, at: number): Promise<boolean> => {
    if (task.habit) {
        const ok = await updateHabit(task.habit.id, h => markDone(h, fromDateKey(date)));
        if (!ok) {
            return false;
        }
    }
    return updateDay(date, day => ({
        ...day,
        finished: { ...day.finished, [task.id]: at },
        skipped: day.skipped.filter(id => id !== task.id),
    }));
};

export const undoTask = async (date: string, task: PlanTask): Promise<boolean> => {
    if (task.habit) {
        const ok = await updateHabit(task.habit.id, h => ({
            ...h,
            completions: h.completions.filter(k => k !== date),
        }));
        if (!ok) {
            return false;
        }
    }
    return updateDay(date, day => ({ ...day, finished: without(day.finished, task.id) }));
};

/** Skips a task for the day (a routine task's streak ends), or brings it back. */
export const setSkipped = (date: string, taskId: string, skipped: boolean): Promise<boolean> =>
    updateDay(date, day => ({
        ...day,
        skipped: skipped ? [...day.skipped.filter(id => id !== taskId), taskId] : day.skipped.filter(id => id !== taskId),
    }));

/** "Later": the task swaps places with the next open one. */
export const moveLater = (date: string, tasks: PlanTask[], taskId: string): Promise<boolean> =>
    updateDay(date, day => ({ ...day, order: laterOrder(tasks, taskId) }));

/**
 * Adds or updates a one-off task. A new one goes right after `afterId` (first
 * when null), or at the end of the day when `afterId` is left out.
 */
export const saveOneOff = async (date: string, task: OneOffTask, afterId?: string | null): Promise<boolean> => {
    const habits = afterId === undefined ? [] : await getHabits();
    return updateDay(date, day => {
        if (day.oneOffs.some(t => t.id === task.id)) {
            return { ...day, oneOffs: day.oneOffs.map(t => (t.id === task.id ? task : t)) };
        }
        const added = { ...day, oneOffs: [...day.oneOffs, task] };
        return afterId === undefined ? added : { ...added, order: orderWith(dayTasks(added, habits), task.id, afterId) };
    });
};

/** A one-off that became a routine task with the same id: it keeps its place and check-off on the day. */
export const promoteOneOff = (date: string, taskId: string): Promise<boolean> =>
    updateDay(date, day => ({ ...day, oneOffs: day.oneOffs.filter(t => t.id !== taskId) }));

export const removeOneOff = (date: string, taskId: string): Promise<boolean> =>
    updateDay(date, day => ({
        ...day,
        oneOffs: day.oneOffs.filter(t => t.id !== taskId),
        order: day.order.filter(id => id !== taskId),
        skipped: day.skipped.filter(id => id !== taskId),
        finished: without(day.finished, taskId),
    }));

/** Remembers when a routine task was checked off elsewhere (e.g. by finishing a workout). */
export const recordFinished = (date: string, taskId: string, at: number): Promise<boolean> =>
    updateDay(date, day => ({ ...day, finished: { ...day.finished, [taskId]: at } }));

// ---- Moving over from time windows ------------------------------------------------

/**
 * Once: turns the old time-window plan into the routine (see
 * routineFromLegacy) and clears the old habit reminders, whose fixed times
 * no longer exist. Never throws.
 */
export const migrateRoutine = async (): Promise<void> => {
    try {
        if (await readBool(KEYS.routineMigrated)) {
            return;
        }
        const [legacy, habits] = await Promise.all([getLegacyPlans(), getHabits()]);
        const latest = legacy.filter(p => p.date <= toDateKey(new Date())).pop() ?? legacy[legacy.length - 1];
        if (latest && latest.blocks.length > 0) {
            const routine = routineFromLegacy(latest.blocks, habits, new Date(), () => newId('h'));
            if (!(await saveHabits(routine))) {
                return;
            }
        }
        await writeJson(KEYS.routineMigrated, true);
        // Not awaited: app start must never wait on the notification service.
        notifee
            .getTriggerNotificationIds()
            .then(ids => notifee.cancelTriggerNotifications(ids.filter(id => id.startsWith('habit:'))))
            .catch(error => logger.warn('Could not clear old habit reminders', error));
    } catch (error) {
        logger.warn('Could not move the old plan into the routine', error);
    }
};

// ---- Notifications ------------------------------------------------------------

const CHANNEL_ID = 'plan';
const ID_PREFIX = 'plan:';

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

/** Everything the reminders are built from. */
const REMINDER_INPUTS: string[] = [
    STORAGE_KEYS.days,
    STORAGE_KEYS.habits,
    STORAGE_KEYS.planPrefs,
    STORAGE_KEYS.sleepSchedule,
];

/**
 * Keeps plan notifications in step with the data: any change to the day,
 * the routine, plan settings or sleep time reschedules them (once per burst
 * of writes). Call once at startup; returns a function that stops watching.
 */
export const watchPlanReminders = (): (() => void) => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const unsubscribe = onStorageChange(key => {
        if (REMINDER_INPUTS.includes(key) && !timer) {
            timer = setTimeout(() => {
                timer = null;
                syncPlanReminders();
            }, 300);
        }
    });
    return () => {
        unsubscribe();
        if (timer) {
            clearTimeout(timer);
        }
    };
};

let syncing: Promise<void> | null = null;
let again = false;

/**
 * Replaces all plan notifications: one when each task of today and tomorrow
 * is estimated to start, so they tell you where you should be by now. Runs
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

        const now = new Date();
        const today = toDateKey(now);
        for (const date of [today, toDateKey(addDays(now, 1))]) {
            const { day, habits, sleep } = await loadDay(date);
            const tasks = dayTasks(day, habits);
            const { slots } = scheduleDay(tasks, anchorsOf(sleep), date === today ? minutesNow(now) : null);
            const open = slots.filter(s => s.task.status === 'open');
            await Promise.all(
                open.map((slot, i) => {
                    const at = timestampOf(date, slot.start);
                    if (at <= now.getTime()) {
                        return Promise.resolve();
                    }
                    const previous = i > 0 ? open[i - 1].task : null;
                    const after = open[i + 1];
                    const title = previous
                        ? `Time for ${slot.task.title} · ${formatDuration(slot.task.duration)}`
                        : `First up: ${slot.task.title} · ${formatDuration(slot.task.duration)}`;
                    const body = [
                        previous ? `Wrap up ${previous.title} and move on.` : motivationFor(date + slot.task.id),
                        after ? `Then ${after.task.title} around ${formatMinutes(after.start)}.` : null,
                    ]
                        .filter(Boolean)
                        .join('\n');
                    return notifee.createTriggerNotification(
                        notification(`${ID_PREFIX}${date}:${slot.task.id}`, title, body),
                        { type: TriggerType.TIMESTAMP, timestamp: at },
                    );
                }),
            );
        }
    } catch (error) {
        logger.warn('Could not schedule plan reminders', error);
    }
};
