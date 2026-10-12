import { DateRange, Money } from '@platform/shared-kernel';
import type { VehicleStatusPort } from '@rental/vehicles/application';
import { Reservation } from '@rental/reservations/domain';

import type { ReservationRepository } from '../../ports/reservation.repository';
import type { AvailabilityService } from '../../services/availability.service';
import type { PricingService } from '../../services/pricing.service';
import { RescheduleReservationHandler } from './reschedule-reservation.handler';

function buildHandler(status: 'Draft' | 'Confirmed') {
  const reservation = Reservation.create({
    companyId: 'company-1',
    customerId: 'customer-1',
    vehicleId: 'vehicle-1',
    dateRange: DateRange.from(new Date('2026-09-01T10:00:00Z'), new Date('2026-09-05T10:00:00Z')),
    baseAmount: Money.from(10000, 'USD'),
  });
  if (status === 'Confirmed') {
    reservation.confirm({
      baseAmount: Money.from(10000, 'USD'),
      isCustomerEligible: true,
      areDriversValidated: true,
    });
  }
  reservation.pullDomainEvents();

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
    isAvailable: jest.fn().mockResolvedValue(true),
    moveOccupancy: jest.fn().mockResolvedValue(undefined),
  } as unknown as AvailabilityService;
  const pricingService = {
    calculateBasePrice: jest.fn().mockResolvedValue(Money.from(30000, 'USD')),
  } as unknown as PricingService;
  const unitOfWork = { run: jest.fn((work: (tx: object) => Promise<void>) => work({})) };
  const eventPublisher = { publish: jest.fn().mockResolvedValue(undefined) };

  const handler = new RescheduleReservationHandler(
    reservationRepository,
    vehicleStatusPort,
    availabilityService,
    pricingService,
    unitOfWork as never,
    eventPublisher,
  );

  return { handler, reservation, availabilityService };
}

describe('RescheduleReservationHandler', () => {
  it('Draft: reemplaza el rango sin mover ninguna ocupacion (nunca se ocupo, RN-05)', async () => {
    const { handler, reservation, availabilityService } = buildHandler('Draft');

    await handler.execute({
      companyId: 'company-1',
      reservationId: reservation.id.toString(),
      newStartDate: new Date('2026-09-10T10:00:00Z'),
      newEndDate: new Date('2026-09-15T10:00:00Z'),
    });

    expect(availabilityService.moveOccupancy).not.toHaveBeenCalled();
  });

  it('Confirmed: reemplaza el rango y mueve la ocupacion via moveOccupancy', async () => {
    const { handler, reservation, availabilityService } = buildHandler('Confirmed');

    await handler.execute({
      companyId: 'company-1',
      reservationId: reservation.id.toString(),
      newStartDate: new Date('2026-09-10T10:00:00Z'),
      newEndDate: new Date('2026-09-15T10:00:00Z'),
    });

    expect(availabilityService.moveOccupancy).toHaveBeenCalledWith(
      'company-1',
      'vehicle-1',
      expect.anything(),
      reservation.id.toString(),
    );
  });
});
