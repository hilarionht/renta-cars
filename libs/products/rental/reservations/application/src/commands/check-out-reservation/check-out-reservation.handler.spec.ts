import { DateRange, Money } from '@platform/shared-kernel';
import type { BranchLookupPort } from '@platform/branches/application';
import type { CustomerLookupPort } from '@rental/customers/application';
import type { VehicleStatusPort } from '@rental/vehicles/application';
import {
  BranchClosedError,
  Reservation,
  VehicleNotAvailableError,
} from '@rental/reservations/domain';

import type { ReservationRepository } from '../../ports/reservation.repository';
import { CheckOutReservationHandler } from './check-out-reservation.handler';

function buildConfirmed(): Reservation {
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
  reservation.pullDomainEvents();
  return reservation;
}

function buildHandler(overrides?: {
  isOperational?: boolean | null;
  branchStatus?: 'Active' | 'Closed' | null;
  areDriversValidated?: boolean;
}) {
  const reservation = buildConfirmed();
  const reservationRepository: ReservationRepository = {
    findById: jest.fn().mockResolvedValue(reservation),
    save: jest.fn().mockResolvedValue(undefined),
  };
  const vehicleStatusPort: VehicleStatusPort = {
    isOperational: jest.fn().mockResolvedValue(overrides?.isOperational ?? true),
    getBranchId: jest.fn().mockResolvedValue('branch-1'),
    getCategoryId: jest.fn(),
  };
  const branchLookupPort: BranchLookupPort = {
    getStatus: jest.fn().mockResolvedValue(overrides?.branchStatus ?? 'Active'),
  };
  const customerLookupPort: CustomerLookupPort = {
    isEligibleForConfirmation: jest.fn(),
    areAdditionalDriversValidated: jest
      .fn()
      .mockResolvedValue(overrides?.areDriversValidated ?? true),
  };
  const unitOfWork = { run: jest.fn((work: (tx: object) => Promise<void>) => work({})) };
  const eventPublisher = { publish: jest.fn().mockResolvedValue(undefined) };

  const handler = new CheckOutReservationHandler(
    reservationRepository,
    vehicleStatusPort,
    branchLookupPort,
    customerLookupPort,
    unitOfWork as never,
    eventPublisher,
  );

  return { handler, reservation, reservationRepository };
}

describe('CheckOutReservationHandler', () => {
  it('Confirmed -> CheckedOut cuando todas las verificaciones pasan', async () => {
    const { handler, reservation, reservationRepository } = buildHandler();

    await handler.execute({
      companyId: 'company-1',
      reservationId: reservation.id.toString(),
      odometer: 1000,
      fuelLevelPercentage: 100,
      photoFileIds: [],
      inspectedBy: 'user-1',
    });

    expect(reservation.status).toBe('CheckedOut');
    expect(reservationRepository.save).toHaveBeenCalled();
  });

  it('lanza BranchClosedError si la branch esta Closed (INV-112)', async () => {
    const { handler, reservation } = buildHandler({ branchStatus: 'Closed' });

    await expect(
      handler.execute({
        companyId: 'company-1',
        reservationId: reservation.id.toString(),
        odometer: 1000,
        fuelLevelPercentage: 100,
        photoFileIds: [],
        inspectedBy: 'user-1',
      }),
    ).rejects.toThrow(BranchClosedError);
  });

  it('lanza VehicleNotAvailableError si el vehicle no es operational (INV-103)', async () => {
    const { handler, reservation } = buildHandler({ isOperational: false });

    await expect(
      handler.execute({
        companyId: 'company-1',
        reservationId: reservation.id.toString(),
        odometer: 1000,
        fuelLevelPercentage: 100,
        photoFileIds: [],
        inspectedBy: 'user-1',
      }),
    ).rejects.toThrow(VehicleNotAvailableError);
  });
});
