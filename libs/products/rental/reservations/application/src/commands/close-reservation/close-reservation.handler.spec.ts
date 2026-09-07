import { DateRange, Money } from '@platform/shared-kernel';
import {
  FuelLevel,
  InvoiceNotYetIssuedError,
  Odometer,
  Reservation,
} from '@rental/reservations/domain';

import type { ReservationRepository } from '../../ports/reservation.repository';
import { CloseReservationHandler } from './close-reservation.handler';

function buildCheckedIn(): Reservation {
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
  reservation.checkIn({
    odometer: Odometer.from(1200),
    fuelLevel: FuelLevel.from(100),
    photoFileIds: [],
    inspectedBy: 'user-1',
    isBranchActive: true,
    branchId: 'branch-1',
  });
  reservation.pullDomainEvents();
  return reservation;
}

function buildHandler() {
  const reservation = buildCheckedIn();
  const reservationRepository: ReservationRepository = {
    findById: jest.fn().mockResolvedValue(reservation),
    save: jest.fn().mockResolvedValue(undefined),
  };
  const unitOfWork = { run: jest.fn((work: (tx: object) => Promise<void>) => work({})) };
  const eventPublisher = { publish: jest.fn().mockResolvedValue(undefined) };

  const handler = new CloseReservationHandler(
    reservationRepository,
    unitOfWork as never,
    eventPublisher,
  );

  return { handler, reservation };
}

describe('CloseReservationHandler', () => {
  it('CheckedIn -> Closed cuando hasInvoiceIssued=true', async () => {
    const { handler, reservation } = buildHandler();

    await handler.execute({
      companyId: 'company-1',
      reservationId: reservation.id.toString(),
      hasInvoiceIssued: true,
    });

    expect(reservation.status).toBe('Closed');
  });

  it('lanza InvoiceNotYetIssuedError si hasInvoiceIssued=false (INV-108)', async () => {
    const { handler, reservation } = buildHandler();

    await expect(
      handler.execute({
        companyId: 'company-1',
        reservationId: reservation.id.toString(),
        hasInvoiceIssued: false,
      }),
    ).rejects.toThrow(InvoiceNotYetIssuedError);
  });
});
