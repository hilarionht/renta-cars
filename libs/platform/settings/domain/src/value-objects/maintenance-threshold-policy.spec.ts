import { MaintenanceThresholdPolicy } from './maintenance-threshold-policy';

describe('MaintenanceThresholdPolicy', () => {
  it('from() acepta solo umbral de kilometraje', () => {
    const policy = MaintenanceThresholdPolicy.from({ applies: true, odometerThresholdKm: 10000 });
    expect(policy.applies).toBe(true);
    expect(policy.odometerThresholdKm).toBe(10000);
    expect(policy.daysThreshold).toBeUndefined();
  });

  it('from() acepta solo umbral de tiempo', () => {
    const policy = MaintenanceThresholdPolicy.from({ applies: true, daysThreshold: 180 });
    expect(policy.daysThreshold).toBe(180);
    expect(policy.odometerThresholdKm).toBeUndefined();
  });

  it('from() acepta ambos umbrales (km y/o tiempo)', () => {
    const policy = MaintenanceThresholdPolicy.from({
      applies: true,
      odometerThresholdKm: 10000,
      daysThreshold: 180,
    });
    expect(policy.odometerThresholdKm).toBe(10000);
    expect(policy.daysThreshold).toBe(180);
  });

  it('from() rechaza applies=true sin ningun umbral', () => {
    expect(() => MaintenanceThresholdPolicy.from({ applies: true })).toThrow(TypeError);
  });

  it('from() rechaza umbrales <= 0', () => {
    expect(() =>
      MaintenanceThresholdPolicy.from({ applies: true, odometerThresholdKm: 0 }),
    ).toThrow(TypeError);
    expect(() => MaintenanceThresholdPolicy.from({ applies: true, daysThreshold: -1 })).toThrow(
      TypeError,
    );
  });

  it('default() no aplica ningun umbral', () => {
    const policy = MaintenanceThresholdPolicy.default();
    expect(policy.applies).toBe(false);
    expect(policy.odometerThresholdKm).toBeUndefined();
    expect(policy.daysThreshold).toBeUndefined();
  });
});
