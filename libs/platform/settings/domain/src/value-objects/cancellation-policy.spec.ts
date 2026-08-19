import { CancellationPolicy } from './cancellation-policy';

describe('CancellationPolicy', () => {
  it('from() acepta tramos validos', () => {
    const policy = CancellationPolicy.from([
      { minHoursBeforeStart: 72, penaltyPercentage: 0 },
      { minHoursBeforeStart: 24, penaltyPercentage: 50 },
      { minHoursBeforeStart: 0, penaltyPercentage: 100 },
    ]);
    expect(policy.tiers).toHaveLength(3);
  });

  it('from() rechaza un arreglo vacio', () => {
    expect(() => CancellationPolicy.from([])).toThrow(TypeError);
  });

  it('from() rechaza minHoursBeforeStart negativo', () => {
    expect(() =>
      CancellationPolicy.from([{ minHoursBeforeStart: -1, penaltyPercentage: 0 }]),
    ).toThrow(TypeError);
  });

  it('from() rechaza penaltyPercentage fuera de [0,100]', () => {
    expect(() =>
      CancellationPolicy.from([{ minHoursBeforeStart: 0, penaltyPercentage: 101 }]),
    ).toThrow(TypeError);
  });

  it('default() no aplica penalidad en ningun tramo', () => {
    expect(CancellationPolicy.default().penaltyPercentageFor(0)).toBe(0);
  });

  it('penaltyPercentageFor() usa el tramo de mayor antelacion que la antelacion real todavia satisface', () => {
    const policy = CancellationPolicy.from([
      { minHoursBeforeStart: 72, penaltyPercentage: 0 },
      { minHoursBeforeStart: 24, penaltyPercentage: 50 },
      { minHoursBeforeStart: 0, penaltyPercentage: 100 },
    ]);
    expect(policy.penaltyPercentageFor(100)).toBe(0);
    expect(policy.penaltyPercentageFor(30)).toBe(50);
    expect(policy.penaltyPercentageFor(1)).toBe(100);
  });
});
