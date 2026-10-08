import { WEEK_DAYS, describeDays } from './schedule';

/** "Every day", "Weekdays", "Weekends", or a short day list, from seven Monday-first flags. */
export const describeHabitDays = (days: boolean[]): string => {
    if (days.every(Boolean)) {
        return 'Every day';
    }
    if (!days.some(Boolean)) {
        return 'No days';
    }
    return describeDays(WEEK_DAYS.filter((_, i) => days[i]).join(', '));
};

/** Short note for a streak milestone. */
export const milestoneMessage = (days: number): string => {
    if (days >= 100) {
        return 'A hundred days and counting. This is now part of your routine.';
    }
    if (days >= 30) {
        return 'A full month of consistency.';
    }
    if (days >= 14) {
        return 'Two consecutive weeks. The habit is taking hold.';
    }
    if (days >= 7) {
        return 'A full week without a miss.';
    }
    return 'A solid start. Keep the chain going.';
};
