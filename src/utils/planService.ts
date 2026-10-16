/** Loading, changing and notifications for the day plan. Pure plan logic lives in dayPlan.ts. */
import notifee, { AndroidImportance, Event, EventType, TriggerType } from '@notifee/react-native';
import { DayHours, DayPlan, Habit, OneOffTask } from '../types/types';
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
    getDayHours,
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
    hours: DayHours;
}

export const loadDay = async (date: string): Promise<LoadedDay> => {
    const [day, habits, hours] = await Promise.all([getDay(date), getHabits(), getDayHours()]);
    return { day, habits, hours };
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
        skipped: skipped
            ? [...day.skipped.filter(id => id !== taskId), taskId]
            : day.skipped.filter(id => id !== taskId),
    }));

/** "Later": the task swaps places with the next open one. */
export const moveLater = (date: string, tasks: PlanTask[], taskId: string): Promise<boolean> =>
    updateDay(date, day => ({ ...day, order: laterOrder(tasks, taskId) }));

/**
 * Adds or updates a one-off task. A new one goes at the end of the day, or
 * with `upNext` right after the task on now, so it's what comes next.
 */
export const saveOneOff = async (date: string, task: OneOffTask, upNext = false): Promise<boolean> => {
    const habits = upNext ? await getHabits() : [];
    return updateDay(date, day => {
        if (day.oneOffs.some(t => t.id === task.id)) {
            return { ...day, oneOffs: day.oneOffs.map(t => (t.id === task.id ? task : t)) };
        }
        const added = { ...day, oneOffs: [...day.oneOffs, task] };
        const tasks = dayTasks(added, habits);
        const current = tasks.find(t => t.status === 'open' && t.id !== task.id);
        return upNext && current ? { ...added, order: orderWith(tasks, task.id, current.id) } : added;
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
/** "Still going" follow-ups; kept across syncs while their task is still open. */
const AGAIN_PREFIX = 'plan-again:';
const AGAIN_AFTER = 15 * 60_000;

const ACTION_DONE = 'plan-done';
const ACTION_AGAIN = 'plan-again';

/** The task a notification asks about: buttons check it off, or ask again later. */
interface Asks {
    date: string;
    taskId: string;
    title: string;
}

const notification = (id: string, title: string, body: string, asks?: Asks) => ({
    id,
    title,
    body,
    data: asks ? { date: asks.date, taskId: asks.taskId, title: asks.title } : undefined,
    android: {
        channelId: CHANNEL_ID,
        smallIcon: 'ic_stat_app',
        pressAction: { id: 'default' },
        // No launchActivity: the buttons work without opening the app.
        actions: asks
            ? [
                  { title: `✓ ${asks.title} done`, pressAction: { id: ACTION_DONE } },
                  { title: 'Still going', pressAction: { id: ACTION_AGAIN } },
              ]
            : undefined,
    },
});

const asksOf = (data: Record<string, unknown> | undefined): Asks | null =>
    data && typeof data.date === 'string' && typeof data.taskId === 'string' && typeof data.title === 'string'
        ? { date: data.date, taskId: data.taskId, title: data.title }
        : null;

/**
 * Handles the buttons on plan notifications (from notifee's foreground and
 * background events): Done checks the task off now, Still going asks again
 * in 15 minutes. Never throws.
 */
export const handlePlanNotificationEvent = async ({ type, detail }: Event): Promise<void> => {
    const action = detail.pressAction?.id;
    const asks = asksOf(detail.notification?.data);
    if (type !== EventType.ACTION_PRESS || !asks || (action !== ACTION_DONE && action !== ACTION_AGAIN)) {
        return;
    }
    try {
        if (detail.notification?.id) {
            await notifee.cancelNotification(detail.notification.id);
        }
        const { day, habits } = await loadDay(asks.date);
        const task = dayTasks(day, habits).find(t => t.id === asks.taskId);
        if (!task || task.status !== 'open') {
            return;
        }
        if (action === ACTION_DONE) {
            const at = asks.date === toDateKey(new Date()) ? minutesNow(new Date()) : 24 * 60 - 1;
            await completeTask(asks.date, task, at);
            await syncPlanReminders();
        } else {
            await notifee.createTriggerNotification(
                notification(
                    `${AGAIN_PREFIX}${asks.date}:${task.id}`,
                    `Still on ${task.title}?`,
                    'Tap Done when it\'s finished, so the rest of the day moves on.',
                    asks,
                ),
                { type: TriggerType.TIMESTAMP, timestamp: Date.now() + AGAIN_AFTER },
            );
        }
    } catch (error) {
        logger.warn('Could not handle a plan notification', error);
    }
};

/** Everything the reminders are built from. */
const REMINDER_INPUTS: string[] = [
    STORAGE_KEYS.days,
    STORAGE_KEYS.habits,
    STORAGE_KEYS.planPrefs,
    STORAGE_KEYS.dayHours,
    STORAGE_KEYS.sleepSchedule,
];

/**
 * Keeps plan notifications in step with the data: any change to the day,
 * the routine, plan settings or day hours reschedules them (once per burst
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
        const pending = await notifee.getTriggerNotificationIds();
        const ids = pending.filter(id => id.startsWith(ID_PREFIX));
        if (ids.length > 0) {
            await notifee.cancelTriggerNotifications(ids);
        }
        const prefs = await getPlanPrefs();
        const now = new Date();
        const today = toDateKey(now);
        // A "Still going" follow-up stays only while its task is still open today.
        const followUps = pending.filter(id => id.startsWith(AGAIN_PREFIX));
        if (followUps.length > 0) {
            const { day, habits } = await loadDay(today);
            const keep = new Set(
                dayTasks(day, habits)
                    .filter(t => t.status === 'open')
                    .map(t => `${AGAIN_PREFIX}${today}:${t.id}`),
            );
            const stale = followUps.filter(id => !prefs.reminders || !keep.has(id));
            if (stale.length > 0) {
                await notifee.cancelTriggerNotifications(stale);
            }
        }
        if (!prefs.reminders) {
            return;
        }
        await notifee.createChannel({ id: CHANNEL_ID, name: 'Day plan', importance: AndroidImportance.HIGH });

        for (const date of [today, toDateKey(addDays(now, 1))]) {
            const { day, habits, hours } = await loadDay(date);
            const tasks = dayTasks(day, habits);
            const { slots } = scheduleDay(tasks, anchorsOf(hours), date === today ? minutesNow(now) : null);
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
                        notification(
                            `${ID_PREFIX}${date}:${slot.task.id}`,
                            title,
                            body,
                            previous ? { date, taskId: previous.id, title: previous.title } : undefined,
                        ),
                        { type: TriggerType.TIMESTAMP, timestamp: at },
                    );
                }),
            );
        }
    } catch (error) {
        logger.warn('Could not schedule plan reminders', error);
    }
};
