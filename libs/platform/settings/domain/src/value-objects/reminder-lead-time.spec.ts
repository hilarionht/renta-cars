import { InvalidValueError } from '@platform/shared-kernel';

import { ReminderLeadTime } from './reminder-lead-time';

describe('ReminderLeadTime', () => {
  it('from() acepta un valor positivo', () => {
    expect(ReminderLeadTime.from(60).leadTimeMinutes).toBe(60);
  });

  it('from() rechaza 0', () => {
    expect(() => ReminderLeadTime.from(0)).toThrow(InvalidValueError);
  });

  it('from() rechaza negativo', () => {
    expect(() => ReminderLeadTime.from(-1)).toThrow(InvalidValueError);
  });

  it('default() es 1440 minutos (24h, placeholder sin calibrar)', () => {
    expect(ReminderLeadTime.default().leadTimeMinutes).toBe(1440);
  });
});
