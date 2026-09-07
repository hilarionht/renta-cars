import { DateRange, Money } from '@platform/shared-kernel';
import type { SettingsLookupPort } from '@platform/settings/application';
import { Reservation, ReservationNotFoundError } from '@rental/reservations/domain';

import type { ReservationRepository } from '../../ports/reservation.repository';
import type { AvailabilityService } from '../../services/availability.service';
import { CancelReservationHandler } from './cancel-reservation.handler';

function buildDraft(): Reservation {
  const reservation = Reservation.create({
    companyId: 'company-1',
    customerId: 'customer-1',
    vehicleId: 'vehicle-1',
    dateRange: DateRange.from(new Date('2026-09-01T10:00:00Z'), new Date('2026-09-05T10:00:00Z')),
    baseAmount: Money.from(10000, 'USD'),
  });
  reservation.pullDomainEvents();
  return reservation;
}

function buildConfirmed(): Reservation {
  const reservation = buildDraft();
  reservation.confirm({
    baseAmount: Money.from(10000, 'USD'),
    isCustomerEligible: true,
    areDriversValidated: true,
  });
  reservation.pullDomainEvents();
  return reservation;
}

function buildHandler(reservation: Reservation, policyOverride?: object | null) {
  const reservationRepository: ReservationRepository = {
    findById: jest.fn().mockResolvedValue(reservation),
    save: jest.fn().mockResolvedValue(undefined),
  };
  const settingsLookupPort = {
    getCancellationPolicy: jest
      .fn()
      .mockResolvedValue(
        policyOverride === null
          ? null
          : (policyOverride ?? { tiers: [{ minHoursBeforeStart: 0, penaltyPercentage: 0 }] }),
      ),
  } as unknown as SettingsLookupPort;
  const availabilityService = {
    release: jest.fn().mockResolvedValue(undefined),
  } as unknown as AvailabilityService;
  const unitOfWork = { run: jest.fn((work: (tx: object) => Promise<void>) => work({})) };
  const eventPublisher = { publish: jest.fn().mockResolvedValue(undefined) };

  const handler = new CancelReservationHandler(
    reservationRepository,
    settingsLookupPort,
    availabilityService,
    unitOfWork as never,
    eventPublisher,
  );

  return { handler, reservationRepository, availabilityService, eventPublisher };
}

describe('CancelReservationHandler', () => {
  it('Draft -> Cancelled sin liberar ningun slot (RN-05, nunca se ocupo)', async () => {
    const reservation = buildDraft();
    const { handler, availabilityService } = buildHandler(reservation);

    await handler.execute({
      companyId: 'company-1',
      reservationId: reservation.id.toString(),
      cancelledBy: 'customer-1',
    });

    expect(reservation.status).toBe('Cancelled');
    expect(availabilityService.release).not.toHaveBeenCalled();
  });

  it('Confirmed -> Cancelled libera el slot y aplica la CancellationPolicy vigente', async () => {
    const reservation = buildConfirmed();
    const { handler, availabilityService } = buildHandler(reservation, {
      tiers: [{ minHoursBeforeStart: 0, penaltyPercentage: 50 }],
    });

    await handler.execute({
      companyId: 'company-1',
      reservationId: reservation.id.toString(),
      cancelledBy: 'agent-1',
    });

    expect(availabilityService.release).toHaveBeenCalledWith('vehicle-1');
    expect(reservation.allPriceAdjustments[0].amount.minorUnits).toBe(5000);
  });

  it('lanza ReservationNotFoundError si pertenece a otra company', async () => {
    const reservation = buildDraft();
    const { handler } = buildHandler(reservation);

    await expect(
      handler.execute({
        companyId: 'other-company',
        reservationId: reservation.id.toString(),
        cancelledBy: 'customer-1',
      }),
    ).rejects.toThrow(ReservationNotFoundError);
  });
});
