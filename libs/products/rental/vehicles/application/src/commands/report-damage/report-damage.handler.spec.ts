import type { DomainEventPublisher, UnitOfWork } from '@platform/shared-kernel';
import {
  LicensePlate,
  Vehicle,
  VehicleHasActiveBookingsError,
  VehicleNotFoundError,
  VIN,
} from '@rental/vehicles/domain';

import { ReportDamageHandler } from './report-damage.handler';
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

  const handler = new ReportDamageHandler(
    vehicleRepository,
    unitOfWork,
    eventPublisher,
    activeBookingsGuard,
    transactionLock,
  );

  return { handler, vehicleRepository, eventPublisher, activeBookingsGuard, transactionLock, tx };
}

describe('ReportDamageHandler', () => {
  it('lanza VehicleNotFoundError si el vehicle no existe o es de otra company', async () => {
    const { handler } = buildHandler(null);

    await expect(
      handler.execute({ vehicleId: UNKNOWN_ID, companyId: 'company-1', severity: 'Minor' }),
    ).rejects.toThrow(VehicleNotFoundError);
  });

  it('Severe transiciona a OutOfService, persiste y publica VehicleStatusChanged.v1', async () => {
    const vehicle = createAvailableVehicle();
    const { handler, vehicleRepository, eventPublisher } = buildHandler(vehicle);

    await handler.execute({
      vehicleId: vehicle.id.toString(),
      companyId: 'company-1',
      severity: 'Severe',
      reason: 'colision',
    });

    expect(vehicle.status).toBe('OutOfService');
    expect(vehicleRepository.save).toHaveBeenCalledTimes(1);
    expect(eventPublisher.publish).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ eventType: 'VehicleStatusChanged.v1' }),
    );
  });

  // docs/persistence/10-DECISIONES.md #137.
  it('Minor crea un mantenimiento correctivo y verifica reservas hasta su fin', async () => {
    const vehicle = createAvailableVehicle();
    const { handler, vehicleRepository, eventPublisher, activeBookingsGuard } =
      buildHandler(vehicle);

    await handler.execute({
      vehicleId: vehicle.id.toString(),
      companyId: 'company-1',
      severity: 'Minor',
    });

    const [corrective] = vehicle.allMaintenanceRecords;
    expect(vehicle.status).toBe('Maintenance');
    expect(corrective.type).toBe('Corrective');
    expect(corrective.status).toBe('Scheduled');
    expect(activeBookingsGuard.assertNoneBlocked).toHaveBeenCalledWith({
      companyId: 'company-1',
      vehicleId: vehicle.id.toString(),
      blockedUntil: corrective.scheduledEnd,
      tx: expect.anything(),
    });
    expect(vehicleRepository.save).toHaveBeenCalledTimes(1);
    expect(eventPublisher.publish).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ eventType: 'MaintenanceScheduled.v1' }),
    );
  });

  it('Severe verifica cualquier reserva activa y, si alguna choca, no guarda nada', async () => {
    const vehicle = createAvailableVehicle();
    const { handler, vehicleRepository, activeBookingsGuard } = buildHandler(vehicle);
    (activeBookingsGuard.assertNoneBlocked as jest.Mock).mockRejectedValue(
      new VehicleHasActiveBookingsError(vehicle.id.toString(), ['reservation-1']),
    );

    await expect(
      handler.execute({
        vehicleId: vehicle.id.toString(),
        companyId: 'company-1',
        severity: 'Severe',
      }),
    ).rejects.toThrow(VehicleHasActiveBookingsError);

    expect(activeBookingsGuard.assertNoneBlocked).toHaveBeenCalledWith(
      expect.objectContaining({ blockedUntil: null }),
    );
    expect(vehicleRepository.save).not.toHaveBeenCalled();
  });
});
