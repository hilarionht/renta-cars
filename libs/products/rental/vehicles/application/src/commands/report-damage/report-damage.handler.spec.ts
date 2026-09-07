import type { DomainEventPublisher, UnitOfWork } from '@platform/shared-kernel';
import { LicensePlate, Vehicle, VehicleNotFoundError, VIN } from '@rental/vehicles/domain';

import { ReportDamageHandler } from './report-damage.handler';
import type { VehicleRepository } from '../../ports/vehicle.repository';

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
  const unitOfWork: UnitOfWork = { run: jest.fn((work) => work({})) };
  const eventPublisher: DomainEventPublisher = { publish: jest.fn().mockResolvedValue(undefined) };

  const handler = new ReportDamageHandler(vehicleRepository, unitOfWork, eventPublisher);

  return { handler, vehicleRepository, eventPublisher };
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
});
