import { Inject, Injectable } from '@nestjs/common';

import { BRANCH_LOOKUP_PORT, type BranchLookupPort } from '@platform/branches/application';
import {
  DOMAIN_EVENT_PUBLISHER,
  type DomainEventPublisher,
  EntityId,
  UNIT_OF_WORK,
  type UnitOfWork,
} from '@platform/shared-kernel';
import {
  LicensePlate,
  Vehicle,
  type VehicleCategoryId,
  VehicleBranchNotFoundError,
  VehicleCategoryNotFoundError,
  type VehicleId,
  VIN,
} from '@rental/vehicles/domain';

import {
  VEHICLE_CATEGORY_REPOSITORY,
  type VehicleCategoryRepository,
} from '../../ports/vehicle-category.repository';
import { VEHICLE_REPOSITORY, type VehicleRepository } from '../../ports/vehicle.repository';
import type { RegisterVehicleCommand } from './register-vehicle.command';

// docs/persistence/03-RELACIONES.md: vehicles.branch_id es cross-schema sin FK real - la
// integridad se valida aca consultando BRANCH_LOOKUP_PORT (primer consumidor real, construido
// sin consumidor en la tanda de Branches). vehicleCategoryId SI es FK real (mismo schema),
// pero se valida igual con un findById explicito para devolver un 404 de dominio limpio en
// vez de dejar que el FK constraint de Postgres burbujee como error generico.
@Injectable()
export class RegisterVehicleHandler {
  constructor(
    @Inject(VEHICLE_REPOSITORY) private readonly vehicleRepository: VehicleRepository,
    @Inject(VEHICLE_CATEGORY_REPOSITORY)
    private readonly vehicleCategoryRepository: VehicleCategoryRepository,
    @Inject(BRANCH_LOOKUP_PORT) private readonly branchLookup: BranchLookupPort,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(DOMAIN_EVENT_PUBLISHER) private readonly eventPublisher: DomainEventPublisher,
  ) {}

  async execute(command: RegisterVehicleCommand): Promise<VehicleId> {
    const branchStatus = await this.branchLookup.getStatus(command.branchId);
    if (branchStatus === null) {
      throw new VehicleBranchNotFoundError(command.branchId);
    }

    const vehicleCategoryId: VehicleCategoryId = EntityId.from(command.vehicleCategoryId);
    const category = await this.vehicleCategoryRepository.findById(vehicleCategoryId);
    if (!category || category.companyId !== command.companyId) {
      throw new VehicleCategoryNotFoundError(command.vehicleCategoryId);
    }

    const vehicle = Vehicle.create({
      companyId: command.companyId,
      branchId: command.branchId,
      vehicleCategoryId: command.vehicleCategoryId,
      licensePlate: LicensePlate.from(command.licensePlate),
      vin: VIN.from(command.vin),
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

    return vehicle.id;
  }
}
