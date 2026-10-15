import { parseInteger, parseMoneyToMinorUnits } from '../src/lib/form-parsing';

// docs/persistence/10-DECISIONES.md #135/#137.
describe('form-parsing', () => {
  it('parseInteger acepta solo enteros no negativos', () => {
    expect(parseInteger(' 1500 ')).toBe(1500);
    expect(parseInteger('15.5')).toBeUndefined();
    expect(parseInteger('-3')).toBeUndefined();
  });

  it('parseMoneyToMinorUnits arma unidades minimas sin float', () => {
    expect(parseMoneyToMinorUnits('1500')).toBe(150000);
    expect(parseMoneyToMinorUnits('1500,5')).toBe(150050);
    expect(parseMoneyToMinorUnits('0.07')).toBe(7);
    expect(parseMoneyToMinorUnits('12.345')).toBeUndefined();
    expect(parseMoneyToMinorUnits('abc')).toBeUndefined();
  });
});
