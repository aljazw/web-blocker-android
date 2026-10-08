import { buildSchedule, describeDays, describeSchedule, isBlockActiveNow } from '../src/utils/schedule';

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

describe('buildSchedule', () => {
    const EVERY = [true, true, true, true, true, true, true];
    const WEEKDAYS = [true, true, true, true, true, false, false];
    const window = (startHour: string, startMinutes: string, endHour: string, endMinutes: string) => ({
        startHour,
        startMinutes,
        endHour,
        endMinutes,
    });

    it('stores a full week, all day, by default', () => {
        expect(buildSchedule(EVERY, null)).toEqual({
            days: 'Full Week',
            time: 'All Day Long',
            problem: null,
            overnight: false,
        });
    });

    it('lists selected days and pads the time window', () => {
        const r = buildSchedule(WEEKDAYS, window('9', '0', '17', '30'));
        expect(r.days).toBe('Mon, Tue, Wed, Thu, Fri');
        expect(r.time).toBe('09:00 - 17:30');
        expect(r.problem).toBeNull();
    });

    it('flags overnight windows without rejecting them', () => {
        const r = buildSchedule(EVERY, window('22', '00', '07', '00'));
        expect(r.overnight).toBe(true);
        expect(r.problem).toBeNull();
    });

    it('rejects no days, incomplete, invalid and empty windows', () => {
        expect(
            buildSchedule(
                EVERY.map(() => false),
                null,
            ).problem,
        ).toMatch(/day/);
        expect(buildSchedule(EVERY, window('09', '', '17', '00')).problem).toMatch(/Fill in/);
        expect(buildSchedule(EVERY, window('24', '00', '17', '00')).problem).toMatch(/valid/);
        expect(buildSchedule(EVERY, window('09', '00', '09', '00')).problem).toMatch(/same/);
    });
});
