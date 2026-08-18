import { Inject, Injectable } from '@nestjs/common';

import { EntityId, UNIT_OF_WORK, type UnitOfWork } from '@platform/shared-kernel';
import { type VehicleId, VehicleNotFoundError } from '@rental/vehicles/domain';

import { VEHICLE_REPOSITORY, type VehicleRepository } from '../../ports/vehicle.repository';
import type { VerifyVehicleDocumentCommand } from './verify-vehicle-document.command';

// Sin evento propio - docs/model/06-DOMAIN_EVENTS.md SS6.1 no lista ningun evento para
// "verificar" un VehicleDocument.
@Injectable()
export class VerifyVehicleDocumentHandler {
  constructor(
    @Inject(VEHICLE_REPOSITORY) private readonly vehicleRepository: VehicleRepository,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
  ) {}

  async execute(command: VerifyVehicleDocumentCommand): Promise<void> {
    const vehicleId: VehicleId = EntityId.from(command.vehicleId);
    const vehicle = await this.vehicleRepository.findById(vehicleId);
    if (!vehicle || vehicle.companyId !== command.companyId) {
      throw new VehicleNotFoundError(command.vehicleId);
    }

    vehicle.verifyDocument(command.documentId);

    await this.unitOfWork.run(async (tx) => {
      await this.vehicleRepository.save(vehicle, tx);
    });
  }
}
