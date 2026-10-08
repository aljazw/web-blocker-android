import { isSleepWindow, isValidTime, sleepDuration } from '../src/utils/sleep';

const at = (hhmm: string) => new Date(`2026-10-07T${hhmm}:00`);
const night = { enabled: true, bedtime: '23:00', wake: '07:00' };

describe('isSleepWindow', () => {
    it('wraps past midnight, bedtime inclusive and wake exclusive', () => {
        expect(isSleepWindow(night, at('22:59'))).toBe(false);
        expect(isSleepWindow(night, at('23:00'))).toBe(true);
        expect(isSleepWindow(night, at('03:00'))).toBe(true);
        expect(isSleepWindow(night, at('06:59'))).toBe(true);
        expect(isSleepWindow(night, at('07:00'))).toBe(false);
    });

    it('handles a window that does not cross midnight', () => {
        const nap = { enabled: true, bedtime: '01:00', wake: '09:00' };
        expect(isSleepWindow(nap, at('00:30'))).toBe(false);
        expect(isSleepWindow(nap, at('05:00'))).toBe(true);
    });

    it('is never active when off or when both times match', () => {
        expect(isSleepWindow({ ...night, enabled: false }, at('03:00'))).toBe(false);
        expect(isSleepWindow({ enabled: true, bedtime: '07:00', wake: '07:00' }, at('07:00'))).toBe(false);
    });
});

describe('helpers', () => {
    it('validates HH:mm', () => {
        expect(isValidTime('23:59')).toBe(true);
        expect(isValidTime('24:00')).toBe(false);
        expect(isValidTime('7:00')).toBe(false);
    });

    it('describes the night length', () => {
        expect(sleepDuration(night)).toBe('8 h');
        expect(sleepDuration({ bedtime: '23:30', wake: '07:00' })).toBe('7 h 30 min');
    });
});
