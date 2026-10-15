import { InvalidValueError } from '@platform/shared-kernel';

import { LateReturnPolicy } from './late-return-policy';

describe('LateReturnPolicy', () => {
  it('from() acepta valores validos', () => {
    const policy = LateReturnPolicy.from({ graceMinutes: 45, penaltyPercentagePerHour: 15 });
    expect(policy.graceMinutes).toBe(45);
    expect(policy.penaltyPercentagePerHour).toBe(15);
  });

  it('from() rechaza graceMinutes negativo', () => {
    expect(() => LateReturnPolicy.from({ graceMinutes: -1, penaltyPercentagePerHour: 0 })).toThrow(
      InvalidValueError,
    );
  });

  it('from() rechaza penaltyPercentagePerHour negativo', () => {
    expect(() => LateReturnPolicy.from({ graceMinutes: 0, penaltyPercentagePerHour: -1 })).toThrow(
      InvalidValueError,
    );
  });

  it('default() usa 30 minutos de gracia y 10% por hora de exceso', () => {
    const policy = LateReturnPolicy.default();
    expect(policy.graceMinutes).toBe(30);
    expect(policy.penaltyPercentagePerHour).toBe(10);
  });
});
