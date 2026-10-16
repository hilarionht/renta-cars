import { DateRange, Money } from '@platform/shared-kernel';
import type { BranchLookupPort } from '@platform/branches/application';
import type { VehicleStatusPort } from '@rental/vehicles/application';
import {
  BranchClosedError,
  FuelLevel,
  Odometer,
  Reservation,
  VehicleNotAvailableError,
} from '@rental/reservations/domain';

import type { ReservationRepository } from '../../ports/reservation.repository';
import type { AvailabilityService } from '../../services/availability.service';
import { SwapVehicleHandler } from './swap-vehicle.handler';

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
    isBranchActive: true,
    branchId: 'branch-1',
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
    isCustomerEligible: true,
  });
  reservation.pullDomainEvents();
  return reservation;
}

function buildHandler(overrides?: {
  isNewVehicleAvailable?: boolean;
  newVehicleBranchStatus?: 'Active' | 'Closed';
}) {
  const reservation = buildCheckedOut();
  const reservationRepository: ReservationRepository = {
    findById: jest.fn().mockResolvedValue(reservation),
    save: jest.fn().mockResolvedValue(undefined),
  };
  const availabilityService = {
    isAvailable: jest.fn().mockResolvedValue(overrides?.isNewVehicleAvailable ?? true),
    reserve: jest.fn().mockResolvedValue(undefined),
    release: jest.fn().mockResolvedValue(undefined),
  } as unknown as AvailabilityService;
  const tx = {};
  const unitOfWork = { run: jest.fn((work: (tx: object) => Promise<void>) => work(tx)) };
  const eventPublisher = { publish: jest.fn().mockResolvedValue(undefined) };
  const vehicleStatusPort: VehicleStatusPort = {
    isOperational: jest.fn().mockResolvedValue(true),
    getBranchId: jest.fn().mockResolvedValue('branch-2'),
    getCategoryId: jest.fn().mockResolvedValue('category-1'),
  };
  const branchLookupPort: BranchLookupPort = {
    getStatus: jest.fn().mockResolvedValue(overrides?.newVehicleBranchStatus ?? 'Active'),
  };
  const transactionLock = { acquire: jest.fn().mockResolvedValue(undefined) };

  const handler = new SwapVehicleHandler(
    reservationRepository,
    availabilityService,
    unitOfWork as never,
    eventPublisher,
    vehicleStatusPort,
    branchLookupPort,
    transactionLock,
  );

  return {
    handler,
    reservation,
    reservationRepository,
    availabilityService,
    branchLookupPort,
    transactionLock,
    tx,
  };
}

describe('SwapVehicleHandler', () => {
  it('ocupa el vehicle nuevo ANTES de liberar el viejo (Hallazgo #2: nunca ambos libres)', async () => {
    const { handler, reservation, availabilityService, tx } = buildHandler();
    const callOrder: string[] = [];
    (availabilityService.reserve as jest.Mock).mockImplementation(() => {
      callOrder.push('reserve');
      return Promise.resolve();
    });
    (availabilityService.release as jest.Mock).mockImplementation(() => {
      callOrder.push('release');
      return Promise.resolve();
    });

    await handler.execute({
      companyId: 'company-1',
      reservationId: reservation.id.toString(),
      newVehicleId: 'vehicle-2',
      reason: 'averia',
    });

    expect(callOrder).toEqual(['reserve', 'release']);
    expect(reservation.vehicleId).toBe('vehicle-2');
    expect(availabilityService.release).toHaveBeenCalledWith(
      'vehicle-1',
      reservation.id.toString(),
      tx,
    );
  });

  it('ocupa, libera y guarda en la misma transaccion, con los locks de sucursal y vehicle (#141)', async () => {
    const {
      handler,
      reservation,
      reservationRepository,
      availabilityService,
      branchLookupPort,
      transactionLock,
      tx,
    } = buildHandler();

    await handler.execute({
      companyId: 'company-1',
      reservationId: reservation.id.toString(),
      newVehicleId: 'vehicle-2',
    });

    expect(transactionLock.acquire.mock.calls).toEqual([
      [tx, 'branch:branch-2', 'shared'],
      [tx, 'vehicle:vehicle-2', 'shared'],
    ]);
    expect(branchLookupPort.getStatus).toHaveBeenCalledWith('branch-2', tx);
    expect(availabilityService.reserve).toHaveBeenCalledWith(
      'company-1',
      'vehicle-2',
      reservation.dateRange,
      reservation.id.toString(),
      tx,
    );
    expect(reservationRepository.save).toHaveBeenCalledWith(reservation, tx);
  });

  it('lanza BranchClosedError si la sucursal del vehicle nuevo esta cerrada (#141)', async () => {
    const { handler, reservation, availabilityService } = buildHandler({
      newVehicleBranchStatus: 'Closed',
    });

    await expect(
      handler.execute({
        companyId: 'company-1',
        reservationId: reservation.id.toString(),
        newVehicleId: 'vehicle-2',
      }),
    ).rejects.toThrow(BranchClosedError);
    expect(availabilityService.reserve).not.toHaveBeenCalled();
    expect(reservation.vehicleId).toBe('vehicle-1');
  });

  it('lanza VehicleNotAvailableError si el vehicle nuevo no esta disponible', async () => {
    const { handler, reservation, availabilityService } = buildHandler({
      isNewVehicleAvailable: false,
    });

    await expect(
      handler.execute({
        companyId: 'company-1',
        reservationId: reservation.id.toString(),
        newVehicleId: 'vehicle-2',
      }),
    ).rejects.toThrow(VehicleNotAvailableError);
    expect(availabilityService.reserve).not.toHaveBeenCalled();
  });
});
