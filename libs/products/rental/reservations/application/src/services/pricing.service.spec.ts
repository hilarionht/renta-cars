import type { SettingsLookupPort } from '@platform/settings/application';
import { DateRange, Money } from '@platform/shared-kernel';
import type { VehicleCategoryLookupPort } from '@rental/vehicles/application';
import { NoActiveRateError } from '@rental/reservations/domain';

import { PricingService } from './pricing.service';

function range(start = '2026-09-01T00:00:00Z', end = '2026-09-04T00:00:00Z'): DateRange {
  return DateRange.from(new Date(start), new Date(end));
}

describe('PricingService', () => {
  describe('calculateBasePrice', () => {
    it('multiplica la Rate diaria vigente por la cantidad de dias del rango', async () => {
      const vehicleCategoryLookupPort: VehicleCategoryLookupPort = {
        getCurrentRate: jest
          .fn()
          .mockResolvedValue({ amountMinorUnits: 5000, currency: 'USD', unit: 'Day' }),
      };
      const service = new PricingService(vehicleCategoryLookupPort, {} as SettingsLookupPort);

      const price = await service.calculateBasePrice('category-1', range());

      expect(price.minorUnits).toBe(15000);
      expect(price.currencyCode).toBe('USD');
    });

    it('lanza NoActiveRateError si no hay ninguna Rate vigente', async () => {
      const vehicleCategoryLookupPort: VehicleCategoryLookupPort = {
        getCurrentRate: jest.fn().mockResolvedValue(null),
      };
      const service = new PricingService(vehicleCategoryLookupPort, {} as SettingsLookupPort);

      await expect(service.calculateBasePrice('category-1', range())).rejects.toThrow(
        NoActiveRateError,
      );
    });
  });

  describe('calculateLateReturnPenalty', () => {
    const service = new PricingService({} as VehicleCategoryLookupPort, {} as SettingsLookupPort);
    const dailyRate = Money.from(10000, 'USD');
    const policy = { graceMinutes: 30, penaltyPercentagePerHour: 10 };

    it('retorna Money(0) dentro de la tolerancia de gracia (RN-16)', () => {
      const scheduled = new Date('2026-09-04T10:00:00Z');
      const actual = new Date('2026-09-04T10:20:00Z');

      const penalty = service.calculateLateReturnPenalty(actual, scheduled, policy, dailyRate);

      expect(penalty.minorUnits).toBe(0);
    });

    it('cobra penaltyPercentagePerHour por cada hora de exceso mas alla de la gracia', () => {
      const scheduled = new Date('2026-09-04T10:00:00Z');
      const actual = new Date('2026-09-04T12:00:00Z');

      const penalty = service.calculateLateReturnPenalty(actual, scheduled, policy, dailyRate);

      expect(penalty.minorUnits).toBe(2000);
    });
  });

  describe('calculateFuelDifferenceCharge', () => {
    const service = new PricingService({} as VehicleCategoryLookupPort, {} as SettingsLookupPort);
    const reference = Money.from(10000, 'USD');

    it('retorna Money(0) si no hay deficit', () => {
      expect(service.calculateFuelDifferenceCharge(100, 100, reference).minorUnits).toBe(0);
      expect(service.calculateFuelDifferenceCharge(50, 80, reference).minorUnits).toBe(0);
    });

    it('cobra proporcional al deficit porcentual', () => {
      expect(service.calculateFuelDifferenceCharge(100, 75, reference).minorUnits).toBe(2500);
    });
  });
});
