import { MinimumBookingLeadTime } from './minimum-booking-lead-time';

describe('MinimumBookingLeadTime', () => {
  it('from() acepta un valor no negativo', () => {
    expect(MinimumBookingLeadTime.from(30).leadTimeMinutes).toBe(30);
  });

  it('from() rechaza negativo', () => {
    expect(() => MinimumBookingLeadTime.from(-1)).toThrow(TypeError);
  });

  it('default() es 0 (sin restriccion)', () => {
    expect(MinimumBookingLeadTime.default().leadTimeMinutes).toBe(0);
  });
});
