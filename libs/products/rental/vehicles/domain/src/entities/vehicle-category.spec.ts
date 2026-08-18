import { Money } from '@platform/shared-kernel';

import { RateOverlapError } from '../errors/rate-overlap.error';
import { CategoryName } from '../value-objects/category-name';
import { VehicleCategory } from './vehicle-category';

function createCategory(): VehicleCategory {
  return VehicleCategory.create({ companyId: 'company-1', name: CategoryName.from('Economico') });
}

describe('VehicleCategory', () => {
  describe('create', () => {
    it('crea la categoria, version 1, y emite VehicleCategoryCreated.v1', () => {
      const category = createCategory();

      expect(category.version).toBe(1);
      expect(category.isNew).toBe(true);
      const events = category.pullDomainEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({ eventType: 'VehicleCategoryCreated.v1' });
    });
  });

  describe('addRate', () => {
    it('agrega la rate, bumpea version y emite RateChanged.v1', () => {
      const category = createCategory();
      category.pullDomainEvents();

      category.addRate({
        amount: Money.from(50000, 'MXN'),
        unit: 'Day',
        validFrom: new Date('2026-01-01'),
      });

      expect(category.version).toBe(2);
      expect(category.allRates).toHaveLength(1);
      const events = category.pullDomainEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({ eventType: 'RateChanged.v1' });
      expect(category.pullDirtyRates()).toHaveLength(1);
    });

    it('INV-010: lanza RateOverlapError si la vigencia se solapa con una rate existente', () => {
      const category = createCategory();
      category.addRate({
        amount: Money.from(50000, 'MXN'),
        unit: 'Day',
        validFrom: new Date('2026-01-01'),
        validTo: new Date('2026-12-01'),
      });

      expect(() =>
        category.addRate({
          amount: Money.from(60000, 'MXN'),
          unit: 'Day',
          validFrom: new Date('2026-06-01'),
        }),
      ).toThrow(RateOverlapError);
    });

    it('acepta rates con vigencias no solapadas', () => {
      const category = createCategory();
      category.addRate({
        amount: Money.from(50000, 'MXN'),
        unit: 'Day',
        validFrom: new Date('2026-01-01'),
        validTo: new Date('2026-06-01'),
      });

      expect(() =>
        category.addRate({
          amount: Money.from(60000, 'MXN'),
          unit: 'Day',
          validFrom: new Date('2026-06-01'),
        }),
      ).not.toThrow();
      expect(category.allRates).toHaveLength(2);
    });
  });
});
