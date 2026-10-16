import { InvalidValueError } from '@platform/shared-kernel';

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
    expect(() => CancellationPolicy.from([])).toThrow(InvalidValueError);
  });

  it('from() rechaza minHoursBeforeStart negativo', () => {
    expect(() =>
      CancellationPolicy.from([{ minHoursBeforeStart: -1, penaltyPercentage: 0 }]),
    ).toThrow(InvalidValueError);
  });

  it('from() rechaza penaltyPercentage fuera de [0,100]', () => {
    expect(() =>
      CancellationPolicy.from([{ minHoursBeforeStart: 0, penaltyPercentage: 101 }]),
    ).toThrow(InvalidValueError);
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

  // #140 (decision del usuario): coherencia, solo para lo que entra.
  it('from() rechaza dos tramos con las mismas horas', () => {
    expect(() =>
      CancellationPolicy.from([
        { minHoursBeforeStart: 24, penaltyPercentage: 10 },
        { minHoursBeforeStart: 24, penaltyPercentage: 50 },
      ]),
    ).toThrow(InvalidValueError);
  });

  it('from() rechaza mas multa con mas anticipacion', () => {
    expect(() =>
      CancellationPolicy.from([
        { minHoursBeforeStart: 48, penaltyPercentage: 80 },
        { minHoursBeforeStart: 0, penaltyPercentage: 10 },
      ]),
    ).toThrow(InvalidValueError);
  });

  it('from() ordena los tramos por anticipacion', () => {
    const policy = CancellationPolicy.from([
      { minHoursBeforeStart: 72, penaltyPercentage: 0 },
      { minHoursBeforeStart: 0, penaltyPercentage: 100 },
    ]);
    expect(policy.tiers.map((tier) => tier.minHoursBeforeStart)).toEqual([0, 72]);
  });

  it('reconstitute() carga sin validar una politica guardada antes de las reglas', () => {
    const policy = CancellationPolicy.reconstitute([
      { minHoursBeforeStart: 24, penaltyPercentage: 10 },
      { minHoursBeforeStart: 24, penaltyPercentage: 50 },
    ]);
    expect(policy.tiers).toHaveLength(2);
  });
});
