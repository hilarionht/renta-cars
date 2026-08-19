import { DateRange, Money } from '@platform/shared-kernel';
import type { CustomerLookupPort } from '@rental/customers/application';
import type { VehicleStatusPort } from '@rental/vehicles/application';
import {
  CustomerNotEligibleError,
  DriverNotValidatedError,
  Reservation,
  ReservationNotFoundError,
  VehicleNotAvailableError,
} from '@rental/reservations/domain';

import type { ReservationRepository } from '../../ports/reservation.repository';
import type { AvailabilityService } from '../../services/availability.service';
import type { PricingService } from '../../services/pricing.service';
import { ConfirmReservationHandler } from './confirm-reservation.handler';

function buildReservation(): Reservation {
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

function buildHandler(overrides?: {
  isCustomerEligible?: boolean | null;
  areDriversValidated?: boolean;
  isAvailable?: boolean;
  reserveImpl?: () => Promise<void>;
}) {
  const reservation = buildReservation();
  const reservationRepository: ReservationRepository = {
    findById: jest.fn().mockResolvedValue(reservation),
    save: jest.fn().mockResolvedValue(undefined),
  };
  const customerLookupPort: CustomerLookupPort = {
    isEligibleForConfirmation: jest.fn().mockResolvedValue(overrides?.isCustomerEligible ?? true),
    areAdditionalDriversValidated: jest
      .fn()
      .mockResolvedValue(overrides?.areDriversValidated ?? true),
  };
  const vehicleStatusPort: VehicleStatusPort = {
    isOperational: jest.fn().mockResolvedValue(true),
    getBranchId: jest.fn(),
    getCategoryId: jest.fn().mockResolvedValue('category-1'),
  };
  const availabilityService = {
    isAvailable: jest.fn().mockResolvedValue(overrides?.isAvailable ?? true),
    reserve: overrides?.reserveImpl
      ? jest.fn(overrides.reserveImpl)
      : jest.fn().mockResolvedValue(undefined),
    release: jest.fn().mockResolvedValue(undefined),
  } as unknown as AvailabilityService;
  const pricingService = {
    calculateBasePrice: jest.fn().mockResolvedValue(Money.from(15000, 'USD')),
  } as unknown as PricingService;
  const unitOfWork = { run: jest.fn((work: (tx: object) => Promise<void>) => work({})) };
  const eventPublisher = { publish: jest.fn().mockResolvedValue(undefined) };

  const handler = new ConfirmReservationHandler(
    reservationRepository,
    customerLookupPort,
    vehicleStatusPort,
    availabilityService,
    pricingService,
    unitOfWork as never,
    eventPublisher,
  );

  return {
    handler,
    reservation,
    reservationRepository,
    customerLookupPort,
    availabilityService,
    eventPublisher,
  };
}

describe('ConfirmReservationHandler', () => {
  it('confirma, ocupa el slot y persiste cuando todas las verificaciones pasan', async () => {
    const { handler, reservation, availabilityService, reservationRepository } = buildHandler();

    await handler.execute({ companyId: 'company-1', reservationId: reservation.id.toString() });

    expect(availabilityService.reserve).toHaveBeenCalledWith(
      'company-1',
      'vehicle-1',
      reservation.dateRange,
      reservation.id.toString(),
    );
    expect(reservation.status).toBe('Confirmed');
    expect(reservationRepository.save).toHaveBeenCalled();
  });

  it('lanza ReservationNotFoundError si no existe o pertenece a otra company', async () => {
    const { handler, reservation } = buildHandler();

    await expect(
      handler.execute({ companyId: 'other-company', reservationId: reservation.id.toString() }),
    ).rejects.toThrow(ReservationNotFoundError);
  });

  it('lanza CustomerNotEligibleError sin tocar CalendarPort si el customer no es elegible', async () => {
    const { handler, reservation, availabilityService } = buildHandler({
      isCustomerEligible: false,
    });

    await expect(
      handler.execute({ companyId: 'company-1', reservationId: reservation.id.toString() }),
    ).rejects.toThrow(CustomerNotEligibleError);
    expect(availabilityService.reserve).not.toHaveBeenCalled();
  });

  it('lanza DriverNotValidatedError si hay un additional driver no Validated', async () => {
    const { handler, reservation } = buildHandler({ areDriversValidated: false });

    await expect(
      handler.execute({ companyId: 'company-1', reservationId: reservation.id.toString() }),
    ).rejects.toThrow(DriverNotValidatedError);
  });

  it('publica ReservationRejectedByAvailability.v1 y lanza VehicleNotAvailableError si el pre-check falla, sin llamar occupy()', async () => {
    const { handler, reservation, availabilityService, eventPublisher, reservationRepository } =
      buildHandler({ isAvailable: false });

    await expect(
      handler.execute({ companyId: 'company-1', reservationId: reservation.id.toString() }),
    ).rejects.toThrow(VehicleNotAvailableError);
    expect(availabilityService.reserve).not.toHaveBeenCalled();
    expect(eventPublisher.publish).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ eventType: 'ReservationRejectedByAvailability.v1' }),
    );
    expect(reservationRepository.save).not.toHaveBeenCalled();
  });

  it('compensa liberando el slot si la persistencia de Reservation falla despues de occupy()', async () => {
    const reservation = buildReservation();
    const reservationRepository: ReservationRepository = {
      findById: jest.fn().mockResolvedValue(reservation),
      save: jest.fn().mockRejectedValue(new Error('concurrent modification')),
    };
    const customerLookupPort: CustomerLookupPort = {
      isEligibleForConfirmation: jest.fn().mockResolvedValue(true),
      areAdditionalDriversValidated: jest.fn().mockResolvedValue(true),
    };
    const vehicleStatusPort: VehicleStatusPort = {
      isOperational: jest.fn().mockResolvedValue(true),
      getBranchId: jest.fn(),
      getCategoryId: jest.fn().mockResolvedValue('category-1'),
    };
    const availabilityService = {
      isAvailable: jest.fn().mockResolvedValue(true),
      reserve: jest.fn().mockResolvedValue(undefined),
      release: jest.fn().mockResolvedValue(undefined),
    } as unknown as AvailabilityService;
    const pricingService = {
      calculateBasePrice: jest.fn().mockResolvedValue(Money.from(15000, 'USD')),
    } as unknown as PricingService;
    const unitOfWork = { run: jest.fn((work: (tx: object) => Promise<void>) => work({})) };
    const eventPublisher = { publish: jest.fn().mockResolvedValue(undefined) };

    const handler = new ConfirmReservationHandler(
      reservationRepository,
      customerLookupPort,
      vehicleStatusPort,
      availabilityService,
      pricingService,
      unitOfWork as never,
      eventPublisher,
    );

    await expect(
      handler.execute({ companyId: 'company-1', reservationId: reservation.id.toString() }),
    ).rejects.toThrow('concurrent modification');
    expect(availabilityService.release).toHaveBeenCalledWith('vehicle-1');
  });
});
