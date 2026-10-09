import { HabitLink } from '../types/types';
import { getHabits, updateHabit } from './storage';
import { isDoneOn, isScheduled, markDone } from './habits';
import { dismissTodaysReminder } from './habitReminders';
import { syncPlanReminders } from './planService';

/**
 * Checks off every habit linked to this kind of training that is due on `day`
 * and not done yet. Returns the titles of the habits it completed.
 */
export const completeLinkedHabits = async (link: HabitLink, day: Date): Promise<string[]> => {
    const linked = (await getHabits()).filter(h => h.link === link && isScheduled(h, day) && !isDoneOn(h, day));
    const completed: string[] = [];
    for (const habit of linked) {
        if (await updateHabit(habit.id, stored => markDone(stored, day))) {
            dismissTodaysReminder(habit);
            completed.push(habit.title);
        }
    }
    if (completed.length > 0) {
        syncPlanReminders();
    }
    return completed;
};
