import { Inject, Injectable } from '@nestjs/common';

import {
  DOMAIN_EVENT_PUBLISHER,
  type DomainEventPublisher,
  EntityId,
  TRANSACTION_LOCK,
  type TransactionLock,
  UNIT_OF_WORK,
  type UnitOfWork,
} from '@platform/shared-kernel';
import {
  type MaintenanceTypeValue,
  type VehicleId,
  VehicleNotFoundError,
} from '@rental/vehicles/domain';

import { ActiveBookingsGuard } from '../../services/active-bookings-guard';
import { vehicleLockKey } from '../../locks/vehicle-lock-key';
import { VEHICLE_REPOSITORY, type VehicleRepository } from '../../ports/vehicle.repository';
import type { ScheduleMaintenanceCommand } from './schedule-maintenance.command';

@Injectable()
export class ScheduleMaintenanceHandler {
  constructor(
    @Inject(VEHICLE_REPOSITORY) private readonly vehicleRepository: VehicleRepository,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(DOMAIN_EVENT_PUBLISHER) private readonly eventPublisher: DomainEventPublisher,
    private readonly activeBookingsGuard: ActiveBookingsGuard,
    @Inject(TRANSACTION_LOCK) private readonly transactionLock: TransactionLock,
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
      // #141: lock exclusivo del vehiculo; el chequeo lee con el mismo tx. Una confirmacion en
      // curso termina antes (y se ve aca); una posterior espera y despues ve el vehiculo bloqueado.
      await this.transactionLock.acquire(tx, vehicleLockKey(vehicle.id.toString()), 'exclusive');
      // #137: el vehiculo queda bloqueado desde ya hasta el fin de la ventana (INV-009).
      await this.activeBookingsGuard.assertNoneBlocked({
        companyId: vehicle.companyId,
        vehicleId: vehicle.id.toString(),
        blockedUntil: command.scheduledEnd,
        tx,
      });
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
