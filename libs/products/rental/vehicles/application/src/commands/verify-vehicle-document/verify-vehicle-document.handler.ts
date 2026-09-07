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

    const versionBeforeVerify = vehicle.version;
    vehicle.verifyDocument(command.documentId);
    if (vehicle.version === versionBeforeVerify) {
      // No-op idempotente (documento ya Verified) - nada que persistir. Llamar a save()
      // igual lanzaria un ConcurrentModificationError espurio (PrismaVehicleRepository.
      // save() asume que version ya se bumpeo, ver docs/persistence/10-DECISIONES.md #56).
      return;
    }

    await this.unitOfWork.run(async (tx) => {
      await this.vehicleRepository.save(vehicle, tx);
    });
  }
}
