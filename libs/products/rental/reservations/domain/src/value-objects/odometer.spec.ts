import { Odometer } from './odometer';

describe('Odometer', () => {
  it('from() acepta un numero no negativo', () => {
    expect(Odometer.from(0).value).toBe(0);
    expect(Odometer.from(1500).value).toBe(1500);
  });

  it('from() rechaza negativo', () => {
    expect(() => Odometer.from(-1)).toThrow(TypeError);
  });
});
