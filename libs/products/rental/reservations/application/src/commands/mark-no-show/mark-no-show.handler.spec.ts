import { DateRange, Money } from '@platform/shared-kernel';
import type { SettingsLookupPort } from '@platform/settings/application';
import { Reservation, ReservationInvalidStateTransitionError } from '@rental/reservations/domain';

import type { ReservationRepository } from '../../ports/reservation.repository';
import type { AvailabilityService } from '../../services/availability.service';
import { MarkNoShowHandler } from './mark-no-show.handler';

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

function buildHandler(reservation: Reservation) {
  const reservationRepository: ReservationRepository = {
    findById: jest.fn().mockResolvedValue(reservation),
    save: jest.fn().mockResolvedValue(undefined),
  };
  const settingsLookupPort = {
    getCancellationPolicy: jest
      .fn()
      .mockResolvedValue({ tiers: [{ minHoursBeforeStart: 0, penaltyPercentage: 100 }] }),
  } as unknown as SettingsLookupPort;
  const availabilityService = {
    release: jest.fn().mockResolvedValue(undefined),
  } as unknown as AvailabilityService;
  const unitOfWork = { run: jest.fn((work: (tx: object) => Promise<void>) => work({})) };
  const eventPublisher = { publish: jest.fn().mockResolvedValue(undefined) };

  const handler = new MarkNoShowHandler(
    reservationRepository,
    settingsLookupPort,
    availabilityService,
    unitOfWork as never,
    eventPublisher,
  );

  return { handler, availabilityService, reservationRepository };
}

describe('MarkNoShowHandler', () => {
  it('Confirmed -> Cancelled(NoShow), libera el slot y aplica la CancellationPolicy (RN-19)', async () => {
    const reservation = buildConfirmed();
    const { handler, availabilityService, reservationRepository } = buildHandler(reservation);

    await handler.execute({ companyId: 'company-1', reservationId: reservation.id.toString() });

    expect(reservation.status).toBe('Cancelled');
    expect(availabilityService.release).toHaveBeenCalledWith('vehicle-1');
    expect(reservationRepository.save).toHaveBeenCalled();
  });

  it('propaga ReservationInvalidStateTransitionError si no esta Confirmed', async () => {
    const reservation = buildConfirmed();
    reservation.markNoShow({});
    reservation.pullDomainEvents();
    const { handler } = buildHandler(reservation);

    await expect(
      handler.execute({ companyId: 'company-1', reservationId: reservation.id.toString() }),
    ).rejects.toThrow(ReservationInvalidStateTransitionError);
  });
});
