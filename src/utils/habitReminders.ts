import notifee, { AndroidImportance, AuthorizationStatus, RepeatFrequency, TriggerType } from '@notifee/react-native';
import { Habit } from '../types/types';
import { logger } from './logger';

const CHANNEL_ID = 'habits';
const idPrefix = (habitId: string) => `habit:${habitId}:`;

/** Asks for notification permission (Android 13+). Resolves whether reminders can be shown. */
export const ensureReminderPermission = async (): Promise<boolean> => {
    try {
        const settings = await notifee.requestPermission();
        return settings.authorizationStatus === AuthorizationStatus.AUTHORIZED;
    } catch (error) {
        logger.warn('Notification permission request failed', error);
        return false;
    }
};

/** Next moment (in the future) that falls on `weekday` (0 = Monday) at hh:mm. */
const nextOccurrence = (weekday: number, hh: number, mm: number, now: Date): Date => {
    const date = new Date(now);
    date.setHours(hh, mm, 0, 0);
    const today = (now.getDay() + 6) % 7;
    let ahead = (weekday - today + 7) % 7;
    if (ahead === 0 && date.getTime() <= now.getTime()) {
        ahead = 7;
    }
    date.setDate(date.getDate() + ahead);
    return date;
};

export const cancelHabitReminders = async (habitId: string): Promise<void> => {
    try {
        const ids = (await notifee.getTriggerNotificationIds()).filter(id => id.startsWith(idPrefix(habitId)));
        if (ids.length > 0) {
            await notifee.cancelTriggerNotifications(ids);
        }
    } catch (error) {
        logger.warn('Could not cancel habit reminders', error);
    }
};

/**
 * Replaces the habit's reminders: one weekly notification per due weekday at
 * the reminder time. Never throws — a reminder failing must not stop saving.
 */
export const syncHabitReminders = async (habit: Habit): Promise<void> => {
    await cancelHabitReminders(habit.id);
    if (!habit.reminder) {
        return;
    }

    try {
        await notifee.createChannel({ id: CHANNEL_ID, name: 'Habit reminders', importance: AndroidImportance.HIGH });
        const [hh, mm] = habit.reminder.split(':').map(Number);
        const now = new Date();

        await Promise.all(
            habit.days.map((due, weekday) =>
                due
                    ? notifee.createTriggerNotification(
                          {
                              id: `${idPrefix(habit.id)}${weekday}`,
                              title: habit.title,
                              body: 'Time to keep your streak going. Tap to check it off.',
                              android: {
                                  channelId: CHANNEL_ID,
                                  smallIcon: 'ic_stat_sitelock',
                                  pressAction: { id: 'default' },
                              },
                          },
                          {
                              type: TriggerType.TIMESTAMP,
                              timestamp: nextOccurrence(weekday, hh, mm, now).getTime(),
                              repeatFrequency: RepeatFrequency.WEEKLY,
                          },
                      )
                    : Promise.resolve(),
            ),
        );
    } catch (error) {
        logger.warn('Could not schedule habit reminders', error);
    }
};

/** Removes today's reminder from the shade once the habit is checked off. */
export const dismissTodaysReminder = async (habit: Habit): Promise<void> => {
    const weekday = (new Date().getDay() + 6) % 7;
    try {
        await notifee.cancelDisplayedNotification(`${idPrefix(habit.id)}${weekday}`);
    } catch {
        // nothing displayed — fine
    }
};
