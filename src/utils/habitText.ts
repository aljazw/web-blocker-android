import { WEEK_DAYS, describeDays } from './schedule';

/** "Every day", "Weekdays", "Weekends", or a short day list, from seven Monday-first flags. */
export const describeHabitDays = (days: boolean[]): string => {
    if (days.every(Boolean)) return 'Every day';
    if (!days.some(Boolean)) return 'No days';
    return describeDays(WEEK_DAYS.filter((_, i) => days[i]).join(', '));
};

/** Encouraging line for a streak milestone. */
export const milestoneMessage = (days: number): string => {
    if (days >= 100) return 'Legendary. This isn’t a habit anymore — it’s who you are.';
    if (days >= 30) return 'A whole month of showing up. That’s real change.';
    if (days >= 14) return 'Two weeks strong. It’s getting easier, isn’t it?';
    if (days >= 7) return 'A full week! You’re building something real.';
    return 'Great start — the hardest part is beginning.';
};
