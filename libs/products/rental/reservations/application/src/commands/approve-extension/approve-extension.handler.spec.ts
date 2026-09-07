import { DateRange, Money } from '@platform/shared-kernel';
import type { VehicleStatusPort } from '@rental/vehicles/application';
import {
  ExtensionCollidesError,
  FuelLevel,
  Odometer,
  Reservation,
} from '@rental/reservations/domain';

import type { ReservationRepository } from '../../ports/reservation.repository';
import type { AvailabilityService } from '../../services/availability.service';
import type { PricingService } from '../../services/pricing.service';
import { ApproveExtensionHandler } from './approve-extension.handler';

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

function buildHandler(overrides?: { isAvailable?: boolean }) {
  const reservation = buildCheckedOut();
  const reservationRepository: ReservationRepository = {
    findById: jest.fn().mockResolvedValue(reservation),
    save: jest.fn().mockResolvedValue(undefined),
  };
  const vehicleStatusPort: VehicleStatusPort = {
    isOperational: jest.fn(),
    getBranchId: jest.fn(),
    getCategoryId: jest.fn().mockResolvedValue('category-1'),
  };
  const availabilityService = {
    isAvailable: jest.fn().mockResolvedValue(overrides?.isAvailable ?? true),
    moveOccupancy: jest.fn().mockResolvedValue(undefined),
  } as unknown as AvailabilityService;
  const pricingService = {
    recalculateForExtension: jest.fn().mockResolvedValue(Money.from(15000, 'USD')),
  } as unknown as PricingService;
  const unitOfWork = { run: jest.fn((work: (tx: object) => Promise<void>) => work({})) };
  const eventPublisher = { publish: jest.fn().mockResolvedValue(undefined) };

  const handler = new ApproveExtensionHandler(
    reservationRepository,
    vehicleStatusPort,
    availabilityService,
    pricingService,
    unitOfWork as never,
    eventPublisher,
  );

  return { handler, reservation, availabilityService };
}

describe('ApproveExtensionHandler', () => {
  it('extiende el rango, agrega PriceAdjustment Extension por el delta, y mueve la ocupacion', async () => {
    const { handler, reservation, availabilityService } = buildHandler();

    await handler.execute({
      companyId: 'company-1',
      reservationId: reservation.id.toString(),
      newEndDate: new Date('2026-09-10T10:00:00Z'),
    });

    expect(reservation.allPriceAdjustments[0]).toMatchObject({ kind: 'Extension' });
    expect(reservation.allPriceAdjustments[0].amount.minorUnits).toBe(5000);
    expect(availabilityService.moveOccupancy).toHaveBeenCalled();
  });

  it('lanza ExtensionCollidesError si el rango extendido colisiona (INV-106)', async () => {
    const { handler, reservation } = buildHandler({ isAvailable: false });

    await expect(
      handler.execute({
        companyId: 'company-1',
        reservationId: reservation.id.toString(),
        newEndDate: new Date('2026-09-10T10:00:00Z'),
      }),
    ).rejects.toThrow(ExtensionCollidesError);
  });
});
