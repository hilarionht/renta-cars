import { DateRange, Money } from '@platform/shared-kernel';
import { FuelLevel, Odometer, Reservation } from '@rental/reservations/domain';

import type { ReservationRepository } from '../../ports/reservation.repository';
import { RequestExtensionHandler } from './request-extension.handler';

describe('RequestExtensionHandler', () => {
  it('emite ExtensionRequested.v1 sin cambiar el status ni el DateRange', async () => {
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

    const reservationRepository: ReservationRepository = {
      findById: jest.fn().mockResolvedValue(reservation),
      save: jest.fn().mockResolvedValue(undefined),
    };
    const unitOfWork = { run: jest.fn((work: (tx: object) => Promise<void>) => work({})) };
    const eventPublisher = { publish: jest.fn().mockResolvedValue(undefined) };

    const handler = new RequestExtensionHandler(
      reservationRepository,
      unitOfWork as never,
      eventPublisher,
    );

    await handler.execute({
      companyId: 'company-1',
      reservationId: reservation.id.toString(),
      requestedNewEndDate: new Date('2026-09-10T10:00:00Z'),
    });

    expect(eventPublisher.publish).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ eventType: 'ExtensionRequested.v1' }),
    );
  });
});
