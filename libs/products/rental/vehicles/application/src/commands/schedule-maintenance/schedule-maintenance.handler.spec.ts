import type { DomainEventPublisher, UnitOfWork } from '@platform/shared-kernel';
import {
  LicensePlate,
  Vehicle,
  VehicleHasActiveBookingsError,
  VehicleNotFoundError,
  VIN,
} from '@rental/vehicles/domain';

import { ScheduleMaintenanceHandler } from './schedule-maintenance.handler';
import type { VehicleRepository } from '../../ports/vehicle.repository';
import type { ActiveBookingsGuard } from '../../services/active-bookings-guard';

const UNKNOWN_ID = '018e5a00-0000-7000-8000-000000000000';

function createAvailableVehicle(): Vehicle {
  const vehicle = Vehicle.create({
    companyId: 'company-1',
    branchId: 'branch-1',
    vehicleCategoryId: 'category-1',
    licensePlate: LicensePlate.from('ABC-1234'),
    vin: VIN.from('1HGCM82633A123456'),
  });
  const documentId = vehicle
    .uploadDocument({
      documentType: 'PropertyCard',
      fileId: 'file-1',
      expiryDate: new Date('2030-01-01'),
    })
    .toString();
  vehicle.verifyDocument(documentId);
  vehicle.enable();
  return vehicle;
}

function buildHandler(existingVehicle: Vehicle | null) {
  const vehicleRepository: VehicleRepository = {
    findById: jest.fn().mockResolvedValue(existingVehicle),
    save: jest.fn().mockResolvedValue(undefined),
  };
  const tx = {};
  const unitOfWork: UnitOfWork = { run: jest.fn((work) => work(tx)) };
  const transactionLock = { acquire: jest.fn().mockResolvedValue(undefined) };
  const eventPublisher: DomainEventPublisher = { publish: jest.fn().mockResolvedValue(undefined) };

  const activeBookingsGuard = {
    assertNoneBlocked: jest.fn().mockResolvedValue(undefined),
  } as unknown as ActiveBookingsGuard;

  const handler = new ScheduleMaintenanceHandler(
    vehicleRepository,
    unitOfWork,
    eventPublisher,
    activeBookingsGuard,
    transactionLock,
  );

  return { handler, vehicleRepository, eventPublisher, activeBookingsGuard, transactionLock, tx };
}

describe('ScheduleMaintenanceHandler', () => {
  it('lanza VehicleNotFoundError si el vehicle no existe o es de otra company', async () => {
    const { handler } = buildHandler(null);

    await expect(
      handler.execute({
        vehicleId: UNKNOWN_ID,
        companyId: 'company-1',
        type: 'Preventive',
        scheduledStart: new Date('2026-02-01T09:00:00.000Z'),
        scheduledEnd: new Date('2026-02-01T17:00:00.000Z'),
      }),
    ).rejects.toThrow(VehicleNotFoundError);
  });

  it('programa el mantenimiento, persiste y publica MaintenanceScheduled.v1', async () => {
    const vehicle = createAvailableVehicle();
    const { handler, vehicleRepository, eventPublisher } = buildHandler(vehicle);

    const maintenanceId = await handler.execute({
      vehicleId: vehicle.id.toString(),
      companyId: 'company-1',
      type: 'Preventive',
      scheduledStart: new Date('2026-02-01T09:00:00.000Z'),
      scheduledEnd: new Date('2026-02-01T17:00:00.000Z'),
    });

    expect(maintenanceId).toBeDefined();
    expect(vehicle.status).toBe('Maintenance');
    expect(vehicleRepository.save).toHaveBeenCalledTimes(1);
    expect(eventPublisher.publish).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ eventType: 'MaintenanceScheduled.v1' }),
    );
  });

  // docs/persistence/10-DECISIONES.md #141.
  it('toma el lock exclusivo del vehiculo y verifica las reservas dentro de la misma transaccion', async () => {
    const vehicle = createAvailableVehicle();
    const { handler, activeBookingsGuard, transactionLock, tx } = buildHandler(vehicle);
    const order: string[] = [];
    transactionLock.acquire.mockImplementation(() => {
      order.push('lock');
      return Promise.resolve();
    });
    (activeBookingsGuard.assertNoneBlocked as jest.Mock).mockImplementation(() => {
      order.push('guard');
      return Promise.resolve();
    });

    await handler.execute({
      vehicleId: vehicle.id.toString(),
      companyId: 'company-1',
      type: 'Preventive',
      scheduledStart: new Date('2026-02-01T09:00:00.000Z'),
      scheduledEnd: new Date('2026-02-01T17:00:00.000Z'),
    });

    expect(order).toEqual(['lock', 'guard']);
    expect(transactionLock.acquire).toHaveBeenCalledWith(
      tx,
      `vehicle:${vehicle.id.toString()}`,
      'exclusive',
    );
    expect(activeBookingsGuard.assertNoneBlocked).toHaveBeenCalledWith(
      expect.objectContaining({ tx }),
    );
  });

  // docs/persistence/10-DECISIONES.md #137.
  it('verifica reservas hasta el fin de la ventana y, si alguna choca, no guarda nada', async () => {
    const vehicle = createAvailableVehicle();
    const { handler, vehicleRepository, activeBookingsGuard } = buildHandler(vehicle);
    const scheduledEnd = new Date('2026-02-01T17:00:00.000Z');
    (activeBookingsGuard.assertNoneBlocked as jest.Mock).mockRejectedValue(
      new VehicleHasActiveBookingsError(vehicle.id.toString(), ['reservation-1']),
    );

    await expect(
      handler.execute({
        vehicleId: vehicle.id.toString(),
        companyId: 'company-1',
        type: 'Preventive',
        scheduledStart: new Date('2026-02-01T09:00:00.000Z'),
        scheduledEnd,
      }),
    ).rejects.toThrow(VehicleHasActiveBookingsError);

    expect(activeBookingsGuard.assertNoneBlocked).toHaveBeenCalledWith({
      companyId: 'company-1',
      vehicleId: vehicle.id.toString(),
      blockedUntil: scheduledEnd,
      tx: expect.anything(),
    });
    expect(vehicleRepository.save).not.toHaveBeenCalled();
  });
});
