import { DateRange } from './date-range';

describe('DateRange', () => {
  describe('from', () => {
    it('lanza TypeError si endDate no es posterior a startDate', () => {
      expect(() => DateRange.from(new Date('2026-06-01'), new Date('2026-01-01'))).toThrow(
        TypeError,
      );
    });

    it('lanza TypeError si endDate es igual a startDate', () => {
      const date = new Date('2026-01-01');
      expect(() => DateRange.from(date, date)).toThrow(TypeError);
    });
  });

  describe('overlaps', () => {
    it('true si los rangos se cruzan', () => {
      const a = DateRange.from(new Date('2026-01-01'), new Date('2026-06-01'));
      const b = DateRange.from(new Date('2026-03-01'), new Date('2026-09-01'));

      expect(a.overlaps(b)).toBe(true);
      expect(b.overlaps(a)).toBe(true);
    });

    it('false si los rangos son adyacentes sin cruzarse', () => {
      const a = DateRange.from(new Date('2026-01-01'), new Date('2026-06-01'));
      const b = DateRange.from(new Date('2026-06-01'), new Date('2026-09-01'));

      expect(a.overlaps(b)).toBe(false);
    });

    it('false si un rango termina antes de que el otro empiece', () => {
      const a = DateRange.from(new Date('2026-01-01'), new Date('2026-02-01'));
      const b = DateRange.from(new Date('2026-06-01'), new Date('2026-09-01'));

      expect(a.overlaps(b)).toBe(false);
    });
  });

  describe('equals', () => {
    it('true si start y end son identicos', () => {
      const a = DateRange.from(new Date('2026-01-01'), new Date('2026-06-01'));
      const b = DateRange.from(new Date('2026-01-01'), new Date('2026-06-01'));

      expect(a.equals(b)).toBe(true);
    });

    it('false si difieren', () => {
      const a = DateRange.from(new Date('2026-01-01'), new Date('2026-06-01'));
      const b = DateRange.from(new Date('2026-01-02'), new Date('2026-06-01'));

      expect(a.equals(b)).toBe(false);
    });
  });
});
