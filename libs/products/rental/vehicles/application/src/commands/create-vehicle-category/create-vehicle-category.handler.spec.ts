import type { DomainEventPublisher, UnitOfWork } from '@platform/shared-kernel';
import type { VehicleCategory } from '@rental/vehicles/domain';

import { CreateVehicleCategoryHandler } from './create-vehicle-category.handler';
import type { VehicleCategoryRepository } from '../../ports/vehicle-category.repository';

function buildHandler() {
  const savedCategories: VehicleCategory[] = [];
  const vehicleCategoryRepository: VehicleCategoryRepository = {
    findById: jest.fn(),
    save: jest.fn((category: VehicleCategory) => {
      savedCategories.push(category);
      return Promise.resolve();
    }),
  };
  const unitOfWork: UnitOfWork = { run: jest.fn((work) => work({})) };
  const eventPublisher: DomainEventPublisher = { publish: jest.fn().mockResolvedValue(undefined) };

  const handler = new CreateVehicleCategoryHandler(
    vehicleCategoryRepository,
    unitOfWork,
    eventPublisher,
  );

  return { handler, vehicleCategoryRepository, eventPublisher, savedCategories };
}

describe('CreateVehicleCategoryHandler', () => {
  it('crea la categoria, persiste y publica VehicleCategoryCreated.v1', async () => {
    const { handler, vehicleCategoryRepository, eventPublisher, savedCategories } = buildHandler();

    const categoryId = await handler.execute({
      companyId: 'company-1',
      name: 'Economico',
      description: 'Categoria economica',
    });

    expect(categoryId.toString()).toBeDefined();
    expect(vehicleCategoryRepository.save).toHaveBeenCalledTimes(1);
    expect(savedCategories).toHaveLength(1);
    expect(savedCategories[0].name.toString()).toBe('Economico');
    expect(eventPublisher.publish).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ eventType: 'VehicleCategoryCreated.v1' }),
    );
  });
});
