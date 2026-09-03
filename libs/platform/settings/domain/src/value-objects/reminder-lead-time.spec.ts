import { ReminderLeadTime } from './reminder-lead-time';

describe('ReminderLeadTime', () => {
  it('from() acepta un valor positivo', () => {
    expect(ReminderLeadTime.from(60).leadTimeMinutes).toBe(60);
  });

  it('from() rechaza 0', () => {
    expect(() => ReminderLeadTime.from(0)).toThrow(TypeError);
  });

  it('from() rechaza negativo', () => {
    expect(() => ReminderLeadTime.from(-1)).toThrow(TypeError);
  });

  it('default() es 1440 minutos (24h, placeholder sin calibrar)', () => {
    expect(ReminderLeadTime.default().leadTimeMinutes).toBe(1440);
  });
});
