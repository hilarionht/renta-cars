import type { DomainEventPublisher, UnitOfWork } from '@platform/shared-kernel';
import {
  CategoryName,
  VehicleCategory,
  VehicleCategoryNotFoundError,
} from '@rental/vehicles/domain';

import { AddRateHandler } from './add-rate.handler';
import type { VehicleCategoryRepository } from '../../ports/vehicle-category.repository';

const UNKNOWN_ID = '018e5a00-0000-7000-8000-000000000000';

function createCategory(): VehicleCategory {
  return VehicleCategory.create({ companyId: 'company-1', name: CategoryName.from('Economico') });
}

function buildHandler(existingCategory: VehicleCategory | null) {
  const vehicleCategoryRepository: VehicleCategoryRepository = {
    findById: jest.fn().mockResolvedValue(existingCategory),
    save: jest.fn().mockResolvedValue(undefined),
  };
  const unitOfWork: UnitOfWork = { run: jest.fn((work) => work({})) };
  const eventPublisher: DomainEventPublisher = { publish: jest.fn().mockResolvedValue(undefined) };

  const handler = new AddRateHandler(vehicleCategoryRepository, unitOfWork, eventPublisher);

  return { handler, vehicleCategoryRepository, eventPublisher };
}

describe('AddRateHandler', () => {
  it('lanza VehicleCategoryNotFoundError si la categoria no existe o es de otra company', async () => {
    const { handler } = buildHandler(null);

    await expect(
      handler.execute({
        vehicleCategoryId: UNKNOWN_ID,
        companyId: 'company-1',
        amountMinorUnits: 50000,
        currency: 'MXN',
        unit: 'Day',
        validFrom: new Date('2026-01-01'),
      }),
    ).rejects.toThrow(VehicleCategoryNotFoundError);
  });

  it('agrega la rate, persiste y publica RateChanged.v1', async () => {
    const category = createCategory();
    const { handler, vehicleCategoryRepository, eventPublisher } = buildHandler(category);

    const rateId = await handler.execute({
      vehicleCategoryId: category.id.toString(),
      companyId: 'company-1',
      amountMinorUnits: 50000,
      currency: 'MXN',
      unit: 'Day',
      validFrom: new Date('2026-01-01'),
    });

    expect(rateId).toBeDefined();
    expect(category.allRates).toHaveLength(1);
    expect(vehicleCategoryRepository.save).toHaveBeenCalledTimes(1);
    expect(eventPublisher.publish).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ eventType: 'RateChanged.v1' }),
    );
  });
});
