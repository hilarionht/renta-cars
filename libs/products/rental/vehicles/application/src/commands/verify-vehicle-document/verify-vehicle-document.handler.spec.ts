import type { UnitOfWork } from '@platform/shared-kernel';
import { LicensePlate, Vehicle, VehicleNotFoundError, VIN } from '@rental/vehicles/domain';

import { VerifyVehicleDocumentHandler } from './verify-vehicle-document.handler';
import type { VehicleRepository } from '../../ports/vehicle.repository';

const UNKNOWN_ID = '018e5a00-0000-7000-8000-000000000000';

function createVehicleWithDocument(): { vehicle: Vehicle; documentId: string } {
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
  return { vehicle, documentId };
}

function buildHandler(existingVehicle: Vehicle | null) {
  const vehicleRepository: VehicleRepository = {
    findById: jest.fn().mockResolvedValue(existingVehicle),
    save: jest.fn().mockResolvedValue(undefined),
  };
  const unitOfWork: UnitOfWork = { run: jest.fn((work) => work({})) };

  const handler = new VerifyVehicleDocumentHandler(vehicleRepository, unitOfWork);

  return { handler, vehicleRepository };
}

describe('VerifyVehicleDocumentHandler', () => {
  it('lanza VehicleNotFoundError si el vehicle no existe o es de otra company', async () => {
    const { handler } = buildHandler(null);

    await expect(
      handler.execute({ vehicleId: UNKNOWN_ID, companyId: 'company-1', documentId: 'doc-1' }),
    ).rejects.toThrow(VehicleNotFoundError);
  });

  it('verifica el documento y persiste', async () => {
    const { vehicle, documentId } = createVehicleWithDocument();
    const { handler, vehicleRepository } = buildHandler(vehicle);

    await handler.execute({ vehicleId: vehicle.id.toString(), companyId: 'company-1', documentId });

    expect(vehicle.allVehicleDocuments[0].status).toBe('Verified');
    expect(vehicleRepository.save).toHaveBeenCalledTimes(1);
  });

  // Regresion del bug real docs/persistence/10-DECISIONES.md #56: verificar un documento ya
  // Verified es idempotente y no bumpea version - save() debe saltearse por completo.
  it('segunda llamada sobre un documento ya Verified es idempotente: no llama a save()', async () => {
    const { vehicle, documentId } = createVehicleWithDocument();
    vehicle.verifyDocument(documentId);
    const { handler, vehicleRepository } = buildHandler(vehicle);

    await handler.execute({ vehicleId: vehicle.id.toString(), companyId: 'company-1', documentId });

    expect(vehicleRepository.save).not.toHaveBeenCalled();
  });
});
