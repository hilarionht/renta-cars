import { FuelLevel } from './fuel-level';

describe('FuelLevel', () => {
  it('from() acepta un porcentaje entre 0 y 100', () => {
    expect(FuelLevel.from(0).value).toBe(0);
    expect(FuelLevel.from(100).value).toBe(100);
  });

  it('from() rechaza fuera de rango', () => {
    expect(() => FuelLevel.from(-1)).toThrow(TypeError);
    expect(() => FuelLevel.from(101)).toThrow(TypeError);
  });
});
