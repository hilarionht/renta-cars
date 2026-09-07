import { overlapDays } from './overlap-days';

describe('overlapDays', () => {
  it('solape total: el slot esta completo dentro del rango', () => {
    const result = overlapDays(
      new Date('2026-01-02T00:00:00.000Z'),
      new Date('2026-01-04T00:00:00.000Z'),
      new Date('2026-01-01T00:00:00.000Z'),
      new Date('2026-01-10T00:00:00.000Z'),
    );
    expect(result).toBe(2);
  });

  it('solape parcial: el slot empieza antes del rango y termina dentro', () => {
    const result = overlapDays(
      new Date('2025-12-30T00:00:00.000Z'),
      new Date('2026-01-03T00:00:00.000Z'),
      new Date('2026-01-01T00:00:00.000Z'),
      new Date('2026-01-10T00:00:00.000Z'),
    );
    expect(result).toBe(2);
  });

  it('sin solape: el slot termina antes de que empiece el rango', () => {
    const result = overlapDays(
      new Date('2025-12-01T00:00:00.000Z'),
      new Date('2025-12-05T00:00:00.000Z'),
      new Date('2026-01-01T00:00:00.000Z'),
      new Date('2026-01-10T00:00:00.000Z'),
    );
    expect(result).toBe(0);
  });

  it('sin solape: el slot empieza despues de que termina el rango', () => {
    const result = overlapDays(
      new Date('2026-02-01T00:00:00.000Z'),
      new Date('2026-02-05T00:00:00.000Z'),
      new Date('2026-01-01T00:00:00.000Z'),
      new Date('2026-01-10T00:00:00.000Z'),
    );
    expect(result).toBe(0);
  });

  it('borde exacto: el slot termina justo cuando empieza el rango (0 dias, nunca negativo)', () => {
    const result = overlapDays(
      new Date('2025-12-30T00:00:00.000Z'),
      new Date('2026-01-01T00:00:00.000Z'),
      new Date('2026-01-01T00:00:00.000Z'),
      new Date('2026-01-10T00:00:00.000Z'),
    );
    expect(result).toBe(0);
  });

  it('dias fraccionarios (horas parciales, no solo fechas)', () => {
    const result = overlapDays(
      new Date('2026-01-01T12:00:00.000Z'),
      new Date('2026-01-02T12:00:00.000Z'),
      new Date('2026-01-01T00:00:00.000Z'),
      new Date('2026-01-10T00:00:00.000Z'),
    );
    expect(result).toBe(1);
  });
});
