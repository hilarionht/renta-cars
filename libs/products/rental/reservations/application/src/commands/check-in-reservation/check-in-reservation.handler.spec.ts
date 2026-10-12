import { DateRange, Money } from '@platform/shared-kernel';
import type { BranchLookupPort } from '@platform/branches/application';
import type { VehicleStatusPort } from '@rental/vehicles/application';
import { FuelLevel, Odometer, Reservation } from '@rental/reservations/domain';

import type { ReservationRepository } from '../../ports/reservation.repository';
import type { AvailabilityService } from '../../services/availability.service';
import type { PricingService } from '../../services/pricing.service';
import { CheckInReservationHandler } from './check-in-reservation.handler';

function buildCheckedOut(): Reservation {
  const reservation = Reservation.create({
    companyId: 'company-1',
    customerId: 'customer-1',
    vehicleId: 'vehicle-1',
    dateRange: DateRange.from(new Date('2026-09-01T10:00:00Z'), new Date('2026-09-05T10:00:00Z')),
    baseAmount: Money.from(10000, 'USD'),
  });
  reservation.confirm({
    baseAmount: Money.from(10000, 'USD'),
    isCustomerEligible: true,
    areDriversValidated: true,
  });
  reservation.checkOut({
    odometer: Odometer.from(1000),
    fuelLevel: FuelLevel.from(100),
    photoFileIds: [],
    inspectedBy: 'user-1',
    isVehicleOperational: true,
    isBranchActive: true,
    branchId: 'branch-1',
    areDriversValidated: true,
  });
  reservation.pullDomainEvents();
  return reservation;
}

function buildHandler() {
  const reservation = buildCheckedOut();
  const reservationRepository: ReservationRepository = {
    findById: jest.fn().mockResolvedValue(reservation),
    save: jest.fn().mockResolvedValue(undefined),
  };
  const vehicleStatusPort: VehicleStatusPort = {
    isOperational: jest.fn(),
    getBranchId: jest.fn().mockResolvedValue('branch-1'),
    getCategoryId: jest.fn().mockResolvedValue('category-1'),
  };
  const branchLookupPort: BranchLookupPort = { getStatus: jest.fn().mockResolvedValue('Active') };
  const pricingService = {
    getDailyRate: jest.fn().mockResolvedValue(Money.from(5000, 'USD')),
    getLateReturnPolicy: jest
      .fn()
      .mockResolvedValue({ graceMinutes: 30, penaltyPercentagePerHour: 10 }),
    calculateLateReturnPenalty: jest.fn().mockReturnValue(Money.from(0, 'USD')),
    calculateFuelDifferenceCharge: jest.fn().mockReturnValue(Money.from(1250, 'USD')),
  } as unknown as PricingService;
  const availabilityService = {
    release: jest.fn().mockResolvedValue(undefined),
  } as unknown as AvailabilityService;
  const unitOfWork = { run: jest.fn((work: (tx: object) => Promise<void>) => work({})) };
  const eventPublisher = { publish: jest.fn().mockResolvedValue(undefined) };

  const handler = new CheckInReservationHandler(
    reservationRepository,
    vehicleStatusPort,
    branchLookupPort,
    pricingService,
    availabilityService,
    unitOfWork as never,
    eventPublisher,
  );

  return { handler, reservation, availabilityService, pricingService };
}

describe('CheckInReservationHandler', () => {
  it('CheckedOut -> CheckedIn, libera el slot y agrega el PriceAdjustment de diferencia de combustible', async () => {
    const { handler, reservation, availabilityService, pricingService } = buildHandler();

    await handler.execute({
      companyId: 'company-1',
      reservationId: reservation.id.toString(),
      odometer: 1200,
      fuelLevelPercentage: 75,
      photoFileIds: [],
      inspectedBy: 'user-1',
    });

    expect(reservation.status).toBe('CheckedIn');
    expect(pricingService.calculateFuelDifferenceCharge).toHaveBeenCalledWith(
      100,
      75,
      expect.anything(),
    );
    expect(
      reservation.allPriceAdjustments.some((adjustment) => adjustment.kind === 'FuelDifference'),
    ).toBe(true);
    expect(availabilityService.release).toHaveBeenCalledWith('vehicle-1');
  });

  it('agrega un DamagePenalty cuando el operador provee un monto', async () => {
    const { handler, reservation } = buildHandler();

    await handler.execute({
      companyId: 'company-1',
      reservationId: reservation.id.toString(),
      odometer: 1200,
      fuelLevelPercentage: 100,
      photoFileIds: [],
      inspectedBy: 'user-1',
      damages: [
        {
          description: 'rayón',
          severity: 'Minor',
          imputableToCustomer: true,
          photoFileIds: [],
          penaltyAmountMinorUnits: 2000,
        },
      ],
    });

    expect(reservation.allDamageReports).toHaveLength(1);
    expect(
      reservation.allPriceAdjustments.find((adjustment) => adjustment.kind === 'DamagePenalty')
        ?.amount.minorUnits,
    ).toBe(2000);
  });
});
