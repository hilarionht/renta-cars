import { Inject, Injectable } from '@nestjs/common';

import {
  DOMAIN_EVENT_PUBLISHER,
  type DomainEventPublisher,
  EntityId,
  Money,
  UNIT_OF_WORK,
  type UnitOfWork,
} from '@platform/shared-kernel';
import {
  type RateUnitValue,
  type VehicleCategoryId,
  VehicleCategoryNotFoundError,
} from '@rental/vehicles/domain';

import {
  VEHICLE_CATEGORY_REPOSITORY,
  type VehicleCategoryRepository,
} from '../../ports/vehicle-category.repository';
import type { AddRateCommand } from './add-rate.command';

@Injectable()
export class AddRateHandler {
  constructor(
    @Inject(VEHICLE_CATEGORY_REPOSITORY)
    private readonly vehicleCategoryRepository: VehicleCategoryRepository,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(DOMAIN_EVENT_PUBLISHER) private readonly eventPublisher: DomainEventPublisher,
  ) {}

  async execute(command: AddRateCommand): Promise<string> {
    const vehicleCategoryId: VehicleCategoryId = EntityId.from(command.vehicleCategoryId);
    const category = await this.vehicleCategoryRepository.findById(vehicleCategoryId);
    if (!category || category.companyId !== command.companyId) {
      throw new VehicleCategoryNotFoundError(command.vehicleCategoryId);
    }

    const rateId = category.addRate({
      amount: Money.from(command.amountMinorUnits, command.currency),
      unit: command.unit as RateUnitValue,
      validFrom: command.validFrom,
      validTo: command.validTo ?? null,
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

    return rateId.toString();
  }
}
