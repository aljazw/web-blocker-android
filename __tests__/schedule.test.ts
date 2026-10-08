import { describeDays, describeSchedule, isBlockActiveNow } from '../src/utils/schedule';

// 2026-10-07 is a Wednesday.
const at = (hhmm: string, date = '2026-10-07') => new Date(`${date}T${hhmm}:00`);

describe('isBlockActiveNow', () => {
    it('blocks all day on every day by default', () => {
        expect(isBlockActiveNow({ days: 'Full Week', time: 'All Day Long' }, at('03:00'))).toBe(true);
    });

    it('only blocks on selected days', () => {
        expect(isBlockActiveNow({ days: 'Wed', time: 'All Day Long' }, at('12:00'))).toBe(true);
        expect(isBlockActiveNow({ days: 'Mon, Tue', time: 'All Day Long' }, at('12:00'))).toBe(false);
        expect(isBlockActiveNow({ days: '', time: 'All Day Long' }, at('12:00'))).toBe(false);
    });

    it('treats the start time as inclusive and the end as exclusive', () => {
        const block = { days: 'Full Week', time: '09:00 - 17:00' };
        expect(isBlockActiveNow(block, at('08:59'))).toBe(false);
        expect(isBlockActiveNow(block, at('09:00'))).toBe(true);
        expect(isBlockActiveNow(block, at('16:59'))).toBe(true);
        expect(isBlockActiveNow(block, at('17:00'))).toBe(false);
    });

    it('handles ranges that wrap past midnight', () => {
        const block = { days: 'Full Week', time: '22:00 - 07:00' };
        expect(isBlockActiveNow(block, at('23:30'))).toBe(true);
        expect(isBlockActiveNow(block, at('06:59'))).toBe(true);
        expect(isBlockActiveNow(block, at('12:00'))).toBe(false);
    });

    it('falls back to all day for an unparseable time', () => {
        expect(isBlockActiveNow({ days: 'Full Week', time: 'Invalid Time' }, at('12:00'))).toBe(true);
    });
});

describe('describeDays', () => {
    it('names common day sets', () => {
        expect(describeDays('Full Week')).toBe('Every day');
        expect(describeDays('Mon, Tue, Wed, Thu, Fri')).toBe('Weekdays');
        expect(describeDays('Sat, Sun')).toBe('Weekends');
    });
});

describe('describeSchedule', () => {
    it('summarises schedules in one short line', () => {
        expect(describeSchedule('Full Week', 'All Day Long')).toBe('Always');
        expect(describeSchedule('Mon, Tue, Wed, Thu, Fri', '09:00 - 17:00')).toBe('Weekdays · 09:00 - 17:00');
        expect(describeSchedule('Sat, Sun', 'All Day Long')).toBe('Weekends · All day');
    });
});
