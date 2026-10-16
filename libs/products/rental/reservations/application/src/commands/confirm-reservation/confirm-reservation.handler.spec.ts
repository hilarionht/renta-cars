import { DateRange, Money, type TransactionLock } from '@platform/shared-kernel';
import type { BranchLookupPort } from '@platform/branches/application';
import type { CustomerLookupPort } from '@rental/customers/application';
import type { VehicleStatusPort } from '@rental/vehicles/application';
import {
  BranchClosedError,
  CustomerNotEligibleError,
  DriverNotValidatedError,
  Reservation,
  ReservationInvalidStateTransitionError,
  ReservationNotFoundError,
  ReservationOverlapError,
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
  // Lo que se relee con el lock tomado (#141).
  isOperationalInLock?: boolean;
  branchStatus?: 'Active' | 'Closed';
  reserveImpl?: () => Promise<void>;
  saveImpl?: () => Promise<void>;
}) {
  const reservation = buildReservation();
  const reservationRepository: ReservationRepository = {
    findById: jest.fn().mockResolvedValue(reservation),
    save: overrides?.saveImpl
      ? jest.fn(overrides.saveImpl)
      : jest.fn().mockResolvedValue(undefined),
  };
  const customerLookupPort: CustomerLookupPort = {
    isEligibleForConfirmation: jest.fn().mockResolvedValue(overrides?.isCustomerEligible ?? true),
    areAdditionalDriversValidated: jest
      .fn()
      .mockResolvedValue(overrides?.areDriversValidated ?? true),
    getContactInfo: jest.fn(),
  };
  const vehicleStatusPort: VehicleStatusPort = {
    isOperational: jest.fn().mockResolvedValue(overrides?.isOperationalInLock ?? true),
    getBranchId: jest.fn().mockResolvedValue('branch-1'),
    getCategoryId: jest.fn().mockResolvedValue('category-1'),
  };
  const branchLookupPort: BranchLookupPort = {
    getStatus: jest.fn().mockResolvedValue(overrides?.branchStatus ?? 'Active'),
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
  const tx = { tx: true };
  const unitOfWork = { run: jest.fn((work: (tx: object) => Promise<void>) => work(tx)) };
  const eventPublisher = { publish: jest.fn().mockResolvedValue(undefined) };
  const transactionLock: TransactionLock = { acquire: jest.fn().mockResolvedValue(undefined) };

  const handler = new ConfirmReservationHandler(
    reservationRepository,
    customerLookupPort,
    vehicleStatusPort,
    availabilityService,
    pricingService,
    unitOfWork as never,
    eventPublisher,
    branchLookupPort,
    transactionLock,
  );

  return {
    handler,
    reservation,
    reservationRepository,
    customerLookupPort,
    vehicleStatusPort,
    branchLookupPort,
    availabilityService,
    eventPublisher,
    transactionLock,
    tx,
  };
}

const rejected = expect.objectContaining({ eventType: 'ReservationRejectedByAvailability.v1' });

describe('ConfirmReservationHandler', () => {
  it('confirma, ocupa el slot y persiste en la misma transaccion (#141)', async () => {
    const { handler, reservation, availabilityService, reservationRepository, tx } = buildHandler();

    await handler.execute({ companyId: 'company-1', reservationId: reservation.id.toString() });

    expect(availabilityService.reserve).toHaveBeenCalledWith(
      'company-1',
      'vehicle-1',
      reservation.dateRange,
      reservation.id.toString(),
      tx,
    );
    expect(reservation.status).toBe('Confirmed');
    expect(reservationRepository.save).toHaveBeenCalledWith(reservation, tx);
  });

  it('toma los locks compartidos de la sucursal y del vehiculo, en ese orden, y relee con el tx', async () => {
    const { handler, reservation, transactionLock, vehicleStatusPort, branchLookupPort, tx } =
      buildHandler();

    await handler.execute({ companyId: 'company-1', reservationId: reservation.id.toString() });

    expect((transactionLock.acquire as jest.Mock).mock.calls).toEqual([
      [tx, 'branch:branch-1', 'shared'],
      [tx, 'vehicle:vehicle-1', 'shared'],
    ]);
    expect(vehicleStatusPort.isOperational).toHaveBeenCalledWith('vehicle-1', tx);
    expect(branchLookupPort.getStatus).toHaveBeenCalledWith('branch-1', tx);
  });

  it('si el guardado falla, el error se propaga y no hay compensacion (la transaccion revierte todo)', async () => {
    const { handler, reservation, availabilityService } = buildHandler({
      saveImpl: () => Promise.reject(new Error('concurrent modification')),
    });

    await expect(
      handler.execute({ companyId: 'company-1', reservationId: reservation.id.toString() }),
    ).rejects.toThrow('concurrent modification');
    expect(availabilityService.release).not.toHaveBeenCalled();
  });

  // #141 (decision del usuario).
  it('rechaza con BranchClosedError si la sucursal del vehiculo esta cerrada, sin publicar rechazo por disponibilidad', async () => {
    const { handler, reservation, availabilityService, eventPublisher } = buildHandler({
      branchStatus: 'Closed',
    });

    await expect(
      handler.execute({ companyId: 'company-1', reservationId: reservation.id.toString() }),
    ).rejects.toThrow(BranchClosedError);
    expect(availabilityService.reserve).not.toHaveBeenCalled();
    expect(eventPublisher.publish).not.toHaveBeenCalledWith(expect.anything(), rejected);
    expect(reservation.status).toBe('Draft');
  });

  it('si el vehiculo dejo de estar operativo (mantenimiento que gano el lock), rechaza y publica el rechazo', async () => {
    const { handler, reservation, availabilityService, eventPublisher } = buildHandler({
      isOperationalInLock: false,
    });

    await expect(
      handler.execute({ companyId: 'company-1', reservationId: reservation.id.toString() }),
    ).rejects.toThrow(VehicleNotAvailableError);
    expect(availabilityService.reserve).not.toHaveBeenCalled();
    expect(eventPublisher.publish).toHaveBeenCalledWith(expect.anything(), rejected);
  });

  it('si otra confirmacion gano el rango (solapamiento), publica el rechazo despues y propaga el error', async () => {
    const { handler, reservation, eventPublisher, reservationRepository } = buildHandler({
      reserveImpl: () => Promise.reject(new ReservationOverlapError('vehicle-1')),
    });

    await expect(
      handler.execute({ companyId: 'company-1', reservationId: reservation.id.toString() }),
    ).rejects.toThrow(ReservationOverlapError);
    expect(reservationRepository.save).not.toHaveBeenCalled();
    expect(eventPublisher.publish).toHaveBeenCalledWith(expect.anything(), rejected);
  });

  it('lanza ReservationNotFoundError si no existe o pertenece a otra company', async () => {
    const { handler, reservation } = buildHandler();

    await expect(
      handler.execute({ companyId: 'other-company', reservationId: reservation.id.toString() }),
    ).rejects.toThrow(ReservationNotFoundError);
  });

  it('lanza ReservationInvalidStateTransitionError (no VehicleNotAvailableError) al confirmar una reservation ya Confirmed, sin tocar CalendarPort (bug real encontrado via smoke test)', async () => {
    const { handler, reservation, availabilityService } = buildHandler();
    reservation.confirm({
      baseAmount: Money.from(10000, 'USD'),
      isCustomerEligible: true,
      areDriversValidated: true,
      isBranchActive: true,
      branchId: 'branch-1',
    });
    reservation.pullDomainEvents();

    await expect(
      handler.execute({ companyId: 'company-1', reservationId: reservation.id.toString() }),
    ).rejects.toThrow(ReservationInvalidStateTransitionError);
    expect(availabilityService.isAvailable).not.toHaveBeenCalled();
    expect(availabilityService.reserve).not.toHaveBeenCalled();
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
    expect(eventPublisher.publish).toHaveBeenCalledWith(expect.anything(), rejected);
    expect(reservationRepository.save).not.toHaveBeenCalled();
  });
});
