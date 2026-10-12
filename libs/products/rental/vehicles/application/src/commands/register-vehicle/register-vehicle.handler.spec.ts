import type { BranchLookupPort } from '@platform/branches/application';
import type { DomainEventPublisher, UnitOfWork } from '@platform/shared-kernel';
import { CategoryName, type Vehicle, VehicleCategory } from '@rental/vehicles/domain';

import { RegisterVehicleHandler } from './register-vehicle.handler';
import type { VehicleCategoryRepository } from '../../ports/vehicle-category.repository';
import type { VehicleRepository } from '../../ports/vehicle.repository';

const UNKNOWN_ID = '018e5a00-0000-7000-8000-000000000000';

function createCategory(): VehicleCategory {
  return VehicleCategory.create({ companyId: 'company-1', name: CategoryName.from('Economico') });
}

function buildHandler(options: {
  branchStatus: 'Active' | 'Closed' | null;
  category: VehicleCategory | null;
}) {
  const savedVehicles: Vehicle[] = [];
  const vehicleRepository: VehicleRepository = {
    findById: jest.fn(),
    save: jest.fn((vehicle: Vehicle) => {
      savedVehicles.push(vehicle);
      return Promise.resolve();
    }),
  };
  const vehicleCategoryRepository: VehicleCategoryRepository = {
    findById: jest.fn().mockResolvedValue(options.category),
    save: jest.fn().mockResolvedValue(undefined),
  };
  const branchLookup: BranchLookupPort = {
    getStatus: jest.fn().mockResolvedValue(options.branchStatus),
  };
  const unitOfWork: UnitOfWork = { run: jest.fn((work) => work({})) };
  const eventPublisher: DomainEventPublisher = { publish: jest.fn().mockResolvedValue(undefined) };

  const handler = new RegisterVehicleHandler(
    vehicleRepository,
    vehicleCategoryRepository,
    branchLookup,
    unitOfWork,
    eventPublisher,
  );

  return { handler, vehicleRepository, branchLookup, eventPublisher, savedVehicles };
}

describe('RegisterVehicleHandler', () => {
  it('lanza VehicleBranchNotFoundError si la branch no existe', async () => {
    const { handler } = buildHandler({ branchStatus: null, category: createCategory() });

    await expect(
      handler.execute({
        companyId: 'company-1',
        branchId: 'branch-1',
        vehicleCategoryId: 'category-1',
        licensePlate: 'ABC-1234',
        vin: '1HGCM82633A123456',
      }),
    ).rejects.toThrow('No existe la branch');
  });

  it('lanza VehicleCategoryNotFoundError si la categoria no existe o es de otra company', async () => {
    const { handler } = buildHandler({ branchStatus: 'Active', category: null });

    await expect(
      handler.execute({
        companyId: 'company-1',
        branchId: 'branch-1',
        vehicleCategoryId: UNKNOWN_ID,
        licensePlate: 'ABC-1234',
        vin: '1HGCM82633A123456',
      }),
    ).rejects.toThrow('No existe la vehicle category');
  });

  it('registra el vehicle, persiste y publica VehicleRegistered.v1', async () => {
    const category = createCategory();
    const { handler, vehicleRepository, eventPublisher, savedVehicles } = buildHandler({
      branchStatus: 'Active',
      category,
    });

    const vehicleId = await handler.execute({
      companyId: category.companyId,
      branchId: 'branch-1',
      vehicleCategoryId: category.id.toString(),
      licensePlate: 'ABC-1234',
      vin: '1HGCM82633A123456',
    });

    expect(vehicleId.toString()).toBeDefined();
    expect(vehicleRepository.save).toHaveBeenCalledTimes(1);
    expect(savedVehicles).toHaveLength(1);
    expect(savedVehicles[0].licensePlate.toString()).toBe('ABC-1234');
    expect(eventPublisher.publish).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ eventType: 'VehicleRegistered.v1', aggregateType: 'Vehicle' }),
    );
  });
});
