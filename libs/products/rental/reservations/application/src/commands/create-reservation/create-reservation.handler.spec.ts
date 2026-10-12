import type { DomainEventPublisher, UnitOfWork } from '@platform/shared-kernel';
import type { VehicleStatusPort } from '@rental/vehicles/application';
import { VehicleNotAvailableError } from '@rental/reservations/domain';

import type { ReservationRepository } from '../../ports/reservation.repository';
import type { PricingService } from '../../services/pricing.service';
import { CreateReservationHandler } from './create-reservation.handler';

function buildHandler(overrides?: { categoryId?: string | null }) {
  const reservationRepository: ReservationRepository = {
    findById: jest.fn(),
    save: jest.fn().mockResolvedValue(undefined),
  };
  const vehicleStatusPort: VehicleStatusPort = {
    isOperational: jest.fn(),
    getBranchId: jest.fn(),
    getCategoryId: jest
      .fn()
      .mockResolvedValue(
        overrides && 'categoryId' in overrides ? overrides.categoryId : 'category-1',
      ),
  };
  const pricingService = {
    calculateBasePrice: jest.fn().mockResolvedValue({ minorUnits: 15000, currencyCode: 'USD' }),
  } as unknown as PricingService;
  const unitOfWork: UnitOfWork = { run: jest.fn((work) => work({})) };
  const eventPublisher: DomainEventPublisher = { publish: jest.fn().mockResolvedValue(undefined) };

  const handler = new CreateReservationHandler(
    reservationRepository,
    vehicleStatusPort,
    pricingService,
    unitOfWork,
    eventPublisher,
  );

  return { handler, reservationRepository, vehicleStatusPort, pricingService, eventPublisher };
}

describe('CreateReservationHandler', () => {
  it('crea la Reservation Draft, persiste y publica ReservationCreated.v1', async () => {
    const { handler, reservationRepository, eventPublisher } = buildHandler();

    const id = await handler.execute({
      companyId: 'company-1',
      customerId: 'customer-1',
      vehicleId: 'vehicle-1',
      startDate: new Date('2026-09-01T10:00:00Z'),
      endDate: new Date('2026-09-05T10:00:00Z'),
    });

    expect(id).toBeDefined();
    expect(reservationRepository.save).toHaveBeenCalled();
    expect(eventPublisher.publish).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ eventType: 'ReservationCreated.v1', aggregateType: 'Reservation' }),
    );
  });

  it('lanza VehicleNotAvailableError si el vehicle no existe (getCategoryId null)', async () => {
    const { handler, reservationRepository } = buildHandler({ categoryId: null });

    await expect(
      handler.execute({
        companyId: 'company-1',
        customerId: 'customer-1',
        vehicleId: 'vehicle-1',
        startDate: new Date('2026-09-01T10:00:00Z'),
        endDate: new Date('2026-09-05T10:00:00Z'),
      }),
    ).rejects.toThrow(VehicleNotAvailableError);
    expect(reservationRepository.save).not.toHaveBeenCalled();
  });
});
