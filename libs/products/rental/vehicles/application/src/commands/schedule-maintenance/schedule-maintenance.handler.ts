import { Inject, Injectable } from '@nestjs/common';

import {
  DOMAIN_EVENT_PUBLISHER,
  type DomainEventPublisher,
  EntityId,
  UNIT_OF_WORK,
  type UnitOfWork,
} from '@platform/shared-kernel';
import {
  type MaintenanceTypeValue,
  type VehicleId,
  VehicleNotFoundError,
} from '@rental/vehicles/domain';

import { VEHICLE_REPOSITORY, type VehicleRepository } from '../../ports/vehicle.repository';
import type { ScheduleMaintenanceCommand } from './schedule-maintenance.command';

@Injectable()
export class ScheduleMaintenanceHandler {
  constructor(
    @Inject(VEHICLE_REPOSITORY) private readonly vehicleRepository: VehicleRepository,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(DOMAIN_EVENT_PUBLISHER) private readonly eventPublisher: DomainEventPublisher,
  ) {}

  async execute(command: ScheduleMaintenanceCommand): Promise<string> {
    const vehicleId: VehicleId = EntityId.from(command.vehicleId);
    const vehicle = await this.vehicleRepository.findById(vehicleId);
    if (!vehicle || vehicle.companyId !== command.companyId) {
      throw new VehicleNotFoundError(command.vehicleId);
    }

    const maintenanceId = vehicle.scheduleMaintenance({
      type: command.type as MaintenanceTypeValue,
      scheduledStart: command.scheduledStart,
      scheduledEnd: command.scheduledEnd,
      responsibleUserId: command.responsibleUserId,
    });

    await this.unitOfWork.run(async (tx) => {
      await this.vehicleRepository.save(vehicle, tx);
      for (const event of vehicle.pullDomainEvents()) {
        await this.eventPublisher.publish(tx, {
          eventType: event.eventType,
          aggregateType: 'Vehicle',
          aggregateId: vehicle.id.toString(),
          companyId: vehicle.companyId,
          payload: { ...event },
        });
      }
    });

    return maintenanceId.toString();
  }
}
