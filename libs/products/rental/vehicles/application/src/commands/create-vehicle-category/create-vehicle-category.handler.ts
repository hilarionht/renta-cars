import { Inject, Injectable } from '@nestjs/common';

import {
  DOMAIN_EVENT_PUBLISHER,
  type DomainEventPublisher,
  UNIT_OF_WORK,
  type UnitOfWork,
} from '@platform/shared-kernel';
import { CategoryName, type VehicleCategoryId, VehicleCategory } from '@rental/vehicles/domain';

import {
  VEHICLE_CATEGORY_REPOSITORY,
  type VehicleCategoryRepository,
} from '../../ports/vehicle-category.repository';
import type { CreateVehicleCategoryCommand } from './create-vehicle-category.command';

@Injectable()
export class CreateVehicleCategoryHandler {
  constructor(
    @Inject(VEHICLE_CATEGORY_REPOSITORY)
    private readonly vehicleCategoryRepository: VehicleCategoryRepository,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(DOMAIN_EVENT_PUBLISHER) private readonly eventPublisher: DomainEventPublisher,
  ) {}

  async execute(command: CreateVehicleCategoryCommand): Promise<VehicleCategoryId> {
    const category = VehicleCategory.create({
      companyId: command.companyId,
      name: CategoryName.from(command.name),
      description: command.description,
    });

    await this.unitOfWork.run(async (tx) => {
      await this.vehicleCategoryRepository.save(category, tx);
      for (const event of category.pullDomainEvents()) {
        await this.eventPublisher.publish(tx, {
          eventType: event.eventType,
          aggregateType: 'VehicleCategory',
          aggregateId: category.id.toString(),
          companyId: category.companyId,
          payload: { ...event },
        });
      }
    });

    return category.id;
  }
}
