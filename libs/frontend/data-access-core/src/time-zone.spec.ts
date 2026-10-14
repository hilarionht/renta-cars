import {
  formatInTimeZone,
  NonexistentLocalTimeError,
  utcIsoToZonedLocal,
  zonedLocalToUtcIso,
} from './time-zone';

// docs/persistence/10-DECISIONES.md #135.
describe('time-zone', () => {
  describe('zona sin cambio de horario (Buenos Aires, UTC-3)', () => {
    const tz = 'America/Argentina/Buenos_Aires';

    it('convierte hora de pared a UTC', () => {
      expect(zonedLocalToUtcIso('2026-10-20T10:00', tz)).toBe('2026-10-20T13:00:00.000Z');
    });

    it('convierte UTC a hora de pared, incluida la medianoche (h23)', () => {
      expect(utcIsoToZonedLocal('2026-10-20T13:00:00.000Z', tz)).toBe('2026-10-20T10:00');
      expect(utcIsoToZonedLocal('2026-10-21T03:00:00.000Z', tz)).toBe('2026-10-21T00:00');
    });

    it('ida y vuelta es identidad', () => {
      const local = '2026-12-31T23:30';
      expect(utcIsoToZonedLocal(zonedLocalToUtcIso(local, tz), tz)).toBe(local);
    });
  });

  describe('zona con cambio de horario (Nueva York)', () => {
    const tz = 'America/New_York';

    it('usa el offset de verano o de invierno segun la fecha', () => {
      expect(zonedLocalToUtcIso('2026-07-01T10:00', tz)).toBe('2026-07-01T14:00:00.000Z');
      expect(zonedLocalToUtcIso('2026-01-15T10:00', tz)).toBe('2026-01-15T15:00:00.000Z');
    });

    it('rechaza una hora que no existe por el salto de primavera', () => {
      expect(() => zonedLocalToUtcIso('2026-03-08T02:30', tz)).toThrow(NonexistentLocalTimeError);
    });

    it('en la hora repetida del otono elige la primera ocurrencia', () => {
      expect(zonedLocalToUtcIso('2026-11-01T01:30', tz)).toBe('2026-11-01T05:30:00.000Z');
    });

    it('justo despues del salto vuelve a ser valida', () => {
      expect(zonedLocalToUtcIso('2026-03-08T03:00', tz)).toBe('2026-03-08T07:00:00.000Z');
    });
  });

  it('rechaza un formato invalido', () => {
    expect(() => zonedLocalToUtcIso('20/10/2026 10:00', 'UTC')).toThrow(TypeError);
  });

  it('formatInTimeZone muestra la hora de la zona, no la del entorno', () => {
    const iso = '2026-10-20T13:00:00.000Z';
    expect(formatInTimeZone(iso, 'America/Argentina/Buenos_Aires')).toContain('10:00');
    expect(formatInTimeZone(iso, 'America/Mexico_City')).toContain('7:00');
    expect(formatInTimeZone(iso, 'America/Argentina/Buenos_Aires', { withZoneName: true })).toMatch(
      /\(.+\)$/,
    );
  });
});
