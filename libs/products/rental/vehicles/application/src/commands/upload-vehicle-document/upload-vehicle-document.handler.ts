import { Inject, Injectable } from '@nestjs/common';

import {
  DOMAIN_EVENT_PUBLISHER,
  type DomainEventPublisher,
  EntityId,
  UNIT_OF_WORK,
  type UnitOfWork,
} from '@platform/shared-kernel';
import {
  type VehicleDocumentTypeValue,
  type VehicleId,
  VehicleNotFoundError,
} from '@rental/vehicles/domain';

import { VEHICLE_REPOSITORY, type VehicleRepository } from '../../ports/vehicle.repository';
import type { UploadVehicleDocumentCommand } from './upload-vehicle-document.command';

// fileId se confia tal cual, sin verificar contra Files (sin FILE_EXISTS_PORT - mismo gap
// ya aceptado que Customers, ver libs/platform/files/infrastructure/src/files.module.ts).
// documentType ya validado contra el catalogo cerrado en el DTO HTTP. A diferencia de
// Customer.uploadIdentityDocument(), este comando SI publica un evento
// (VehicleDocumentationLoaded.v1 esta en el catalogo con consumidor real).
@Injectable()
export class UploadVehicleDocumentHandler {
  constructor(
    @Inject(VEHICLE_REPOSITORY) private readonly vehicleRepository: VehicleRepository,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(DOMAIN_EVENT_PUBLISHER) private readonly eventPublisher: DomainEventPublisher,
  ) {}

  async execute(command: UploadVehicleDocumentCommand): Promise<string> {
    const vehicleId: VehicleId = EntityId.from(command.vehicleId);
    const vehicle = await this.vehicleRepository.findById(vehicleId);
    if (!vehicle || vehicle.companyId !== command.companyId) {
      throw new VehicleNotFoundError(command.vehicleId);
    }

    const documentId = vehicle.uploadDocument({
      documentType: command.documentType as VehicleDocumentTypeValue,
      fileId: command.fileId,
      expiryDate: command.expiryDate,
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

    return documentId.toString();
  }
}
