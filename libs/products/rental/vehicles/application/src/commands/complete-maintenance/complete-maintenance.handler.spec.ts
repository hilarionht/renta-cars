import type { DomainEventPublisher, UnitOfWork } from '@platform/shared-kernel';
import { LicensePlate, Vehicle, VehicleNotFoundError, VIN } from '@rental/vehicles/domain';

import { CompleteMaintenanceHandler } from './complete-maintenance.handler';
import type { VehicleRepository } from '../../ports/vehicle.repository';

const UNKNOWN_ID = '018e5a00-0000-7000-8000-000000000000';

function createVehicleWithInProgressMaintenance(): { vehicle: Vehicle; maintenanceId: string } {
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
  const maintenanceId = vehicle
    .scheduleMaintenance({
      type: 'Preventive',
      scheduledStart: new Date('2026-02-01T09:00:00.000Z'),
      scheduledEnd: new Date('2026-02-01T17:00:00.000Z'),
    })
    .toString();
  vehicle.startMaintenance(maintenanceId);
  return { vehicle, maintenanceId };
}

function buildHandler(existingVehicle: Vehicle | null) {
  const vehicleRepository: VehicleRepository = {
    findById: jest.fn().mockResolvedValue(existingVehicle),
    save: jest.fn().mockResolvedValue(undefined),
  };
  const unitOfWork: UnitOfWork = { run: jest.fn((work) => work({})) };
  const eventPublisher: DomainEventPublisher = { publish: jest.fn().mockResolvedValue(undefined) };

  const handler = new CompleteMaintenanceHandler(vehicleRepository, unitOfWork, eventPublisher);

  return { handler, vehicleRepository, eventPublisher };
}

describe('CompleteMaintenanceHandler', () => {
  it('lanza VehicleNotFoundError si el vehicle no existe o es de otra company', async () => {
    const { handler } = buildHandler(null);

    await expect(
      handler.execute({
        vehicleId: UNKNOWN_ID,
        companyId: 'company-1',
        maintenanceId: 'maintenance-1',
        fitForService: true,
      }),
    ).rejects.toThrow(VehicleNotFoundError);
  });

  it('completa el mantenimiento, persiste y publica MaintenanceCompleted.v1', async () => {
    const { vehicle, maintenanceId } = createVehicleWithInProgressMaintenance();
    const { handler, vehicleRepository, eventPublisher } = buildHandler(vehicle);

    await handler.execute({
      vehicleId: vehicle.id.toString(),
      companyId: 'company-1',
      maintenanceId,
      fitForService: true,
    });

    expect(vehicle.status).toBe('Available');
    expect(vehicleRepository.save).toHaveBeenCalledTimes(1);
    expect(eventPublisher.publish).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ eventType: 'MaintenanceCompleted.v1' }),
    );
  });
});
