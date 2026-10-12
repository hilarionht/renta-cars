import type { DomainEventPublisher, UnitOfWork } from '@platform/shared-kernel';
import { LicensePlate, Vehicle, VehicleNotFoundError, VIN } from '@rental/vehicles/domain';

import { UploadVehicleDocumentHandler } from './upload-vehicle-document.handler';
import type { VehicleRepository } from '../../ports/vehicle.repository';

const UNKNOWN_ID = '018e5a00-0000-7000-8000-000000000000';

function createVehicle(): Vehicle {
  return Vehicle.create({
    companyId: 'company-1',
    branchId: 'branch-1',
    vehicleCategoryId: 'category-1',
    licensePlate: LicensePlate.from('ABC-1234'),
    vin: VIN.from('1HGCM82633A123456'),
  });
}

function buildHandler(existingVehicle: Vehicle | null) {
  const vehicleRepository: VehicleRepository = {
    findById: jest.fn().mockResolvedValue(existingVehicle),
    save: jest.fn().mockResolvedValue(undefined),
  };
  const unitOfWork: UnitOfWork = { run: jest.fn((work) => work({})) };
  const eventPublisher: DomainEventPublisher = { publish: jest.fn().mockResolvedValue(undefined) };

  const handler = new UploadVehicleDocumentHandler(vehicleRepository, unitOfWork, eventPublisher);

  return { handler, vehicleRepository, eventPublisher };
}

describe('UploadVehicleDocumentHandler', () => {
  it('lanza VehicleNotFoundError si el vehicle no existe o es de otra company', async () => {
    const { handler } = buildHandler(null);

    await expect(
      handler.execute({
        vehicleId: UNKNOWN_ID,
        companyId: 'company-1',
        documentType: 'PropertyCard',
        fileId: 'file-1',
        expiryDate: new Date('2030-01-01'),
      }),
    ).rejects.toThrow(VehicleNotFoundError);
  });

  it('carga el documento, persiste y publica VehicleDocumentationLoaded.v1', async () => {
    const vehicle = createVehicle();
    const { handler, vehicleRepository, eventPublisher } = buildHandler(vehicle);

    const documentId = await handler.execute({
      vehicleId: vehicle.id.toString(),
      companyId: 'company-1',
      documentType: 'PropertyCard',
      fileId: 'file-1',
      expiryDate: new Date('2030-01-01'),
    });

    expect(documentId).toBeDefined();
    expect(vehicle.allVehicleDocuments).toHaveLength(1);
    expect(vehicleRepository.save).toHaveBeenCalledTimes(1);
    expect(eventPublisher.publish).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ eventType: 'VehicleDocumentationLoaded.v1' }),
    );
  });
});
