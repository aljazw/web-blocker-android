import { HabitLink } from '../types/types';
import { getHabits, updateHabit } from '../storage';
import { isDoneOn, isScheduled, markDone, toDateKey } from './habits';
import { minutesNow } from './dayPlan';
import { recordFinished } from './planService';

/**
 * Checks off every routine task linked to this kind of training that is due
 * on `day` and not done yet. Returns the titles of the tasks it completed.
 */
export const completeLinkedHabits = async (link: HabitLink, day: Date): Promise<string[]> => {
    const linked = (await getHabits()).filter(h => h.link === link && isScheduled(h, day) && !isDoneOn(h, day));
    const completed: string[] = [];
    for (const habit of linked) {
        if (await updateHabit(habit.id, stored => markDone(stored, day))) {
            // The day plan moves on from here.
            await recordFinished(toDateKey(day), habit.id, minutesNow(new Date()));
            completed.push(habit.title);
        }
    }
    return completed;
};
