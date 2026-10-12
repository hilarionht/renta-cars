import { Money } from '@platform/shared-kernel';

import { Rate } from './rate';

function createRate(validFrom: string, validTo: string | null): Rate {
  return Rate.create({
    amount: Money.from(50000, 'MXN'),
    unit: 'Day',
    validFrom: new Date(validFrom),
    validTo: validTo ? new Date(validTo) : null,
  });
}

describe('Rate', () => {
  describe('create', () => {
    it('lanza TypeError si validTo no es posterior a validFrom', () => {
      expect(() => createRate('2026-06-01', '2026-01-01')).toThrow(TypeError);
    });

    it('acepta validTo null (vigencia abierta)', () => {
      const rate = createRate('2026-01-01', null);

      expect(rate.validTo).toBeNull();
    });
  });

  describe('overlaps', () => {
    it('true si los rangos se cruzan', () => {
      const a = createRate('2026-01-01', '2026-06-01');
      const b = createRate('2026-03-01', '2026-09-01');

      expect(a.overlaps(b)).toBe(true);
      expect(b.overlaps(a)).toBe(true);
    });

    it('false si los rangos son adyacentes sin cruzarse', () => {
      const a = createRate('2026-01-01', '2026-06-01');
      const b = createRate('2026-06-01', '2026-09-01');

      expect(a.overlaps(b)).toBe(false);
    });

    it('trata validTo=null como sin cota superior', () => {
      const open = createRate('2026-01-01', null);
      const later = createRate('2027-01-01', '2027-06-01');

      expect(open.overlaps(later)).toBe(true);
    });

    it('false si un rango termina antes de que el otro empiece', () => {
      const a = createRate('2026-01-01', '2026-02-01');
      const b = createRate('2026-06-01', '2026-09-01');

      expect(a.overlaps(b)).toBe(false);
    });
  });
});
