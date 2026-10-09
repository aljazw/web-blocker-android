import { WorkoutRecord, WorkoutSession } from '../types/types';
import { recordFromSession } from './workout';
import { addWorkoutRecord, setWorkoutSession } from './storage';
import { completeLinkedHabits } from './habitLinks';
import { logger } from './logger';

export interface FinishedWorkout {
    record: WorkoutRecord;
    /** Titles of habits that were checked off by this workout. */
    habits: string[];
}

/**
 * Stores a finished session: saves its record (unless no set was done),
 * checks off linked habits when it reached the end, and clears the session.
 */
export const saveFinishedWorkout = async (session: WorkoutSession): Promise<FinishedWorkout | null> => {
    const record = recordFromSession(session);
    let habits: string[] = [];
    if (record.setsDone > 0) {
        if (!(await addWorkoutRecord(record))) {
            logger.warn('Could not save workout record');
            return null;
        }
        if (record.completed) {
            habits = await completeLinkedHabits('workout', new Date(record.startedAt)).catch(error => {
                logger.warn('Could not complete linked habits', error);
                return [];
            });
        }
    }
    await setWorkoutSession(null);
    return { record, habits };
};
