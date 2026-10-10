import { isOnVacation, isValidVacation, vacationDays, vacationPhase } from '../src/utils/vacation';

const at = (key: string, hour = 12) => {
    const [y, m, d] = key.split('-').map(Number);
    return new Date(y, m - 1, d, hour);
};

describe('vacation', () => {
    const trip = { start: '2026-10-12', end: '2026-10-20' };

    it('includes both the first and the last day', () => {
        expect(vacationPhase(trip, at('2026-10-11', 23))).toBe('upcoming');
        expect(vacationPhase(trip, at('2026-10-12', 0))).toBe('active');
        expect(vacationPhase(trip, at('2026-10-20', 23))).toBe('active');
        expect(vacationPhase(trip, at('2026-10-21', 0))).toBe('over');
    });

    it('is only "on vacation" while active', () => {
        expect(isOnVacation(null)).toBe(false);
        expect(isOnVacation(trip, at('2026-10-15'))).toBe(true);
        expect(isOnVacation(trip, at('2026-10-25'))).toBe(false);
    });

    it('counts days inclusively, across month ends and DST', () => {
        expect(vacationDays(trip)).toBe(9);
        expect(vacationDays({ start: '2026-10-20', end: '2026-10-20' })).toBe(1);
        expect(vacationDays({ start: '2026-10-30', end: '2026-11-02' })).toBe(4);
    });

    it('rejects backwards, malformed and impossible dates', () => {
        expect(isValidVacation(trip)).toBe(true);
        expect(isValidVacation({ start: '2026-10-20', end: '2026-10-12' })).toBe(false);
        expect(isValidVacation({ start: '2026-10-12', end: 'soon' })).toBe(false);
        expect(isValidVacation({ start: '2026-02-30', end: '2026-03-02' })).toBe(false);
    });
});
