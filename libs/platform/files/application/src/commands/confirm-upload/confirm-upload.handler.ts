import { Inject, Injectable } from '@nestjs/common';

import {
  DOMAIN_EVENT_PUBLISHER,
  type DomainEventPublisher,
  UNIT_OF_WORK,
  type UnitOfWork,
} from '@platform/shared-kernel';
import {
  ContentType,
  File,
  type FileId,
  FileTooLargeError,
  StorageObjectNotFoundError,
  StorageRef,
  UnsupportedContentTypeError,
} from '@platform/files/domain';

import { FILE_REPOSITORY, type FileRepository } from '../../ports/file.repository';
import { STORAGE_LIMITS, type StorageLimits } from '../../ports/storage-limits';
import { STORAGE_PROVIDER_PORT, type StorageProviderPort } from '../../ports/storage-provider.port';
import type { ConfirmUploadCommand } from './confirm-upload.command';

@Injectable()
export class ConfirmUploadHandler {
  constructor(
    @Inject(STORAGE_PROVIDER_PORT) private readonly storageProvider: StorageProviderPort,
    @Inject(FILE_REPOSITORY) private readonly fileRepository: FileRepository,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(DOMAIN_EVENT_PUBLISHER) private readonly eventPublisher: DomainEventPublisher,
    @Inject(STORAGE_LIMITS) private readonly storageLimits: StorageLimits,
  ) {}

  async execute(command: ConfirmUploadCommand): Promise<FileId> {
    const contentType = ContentType.from(command.contentType);

    const verification = await this.storageProvider.verifyUploadedObject({
      storageRef: command.storageRef,
    });
    if (!verification.exists) {
      throw new StorageObjectNotFoundError(command.storageRef);
    }

    // contentType NO queda firmado en la URL de subida (el presigner de AWS SDK excluye
    // "content-type" de los headers firmados de forma incondicional, verificado en el test
    // de integracion del adaptador) - un PUT puede llegar con cualquier Content-Type sin
    // que storage lo rechace. El unico enforcement real es este: comparar lo que
    // verifyUploadedObject midio de verdad contra el allowlist, aca, antes de crear el
    // File. Ver docs/persistence/10-DECISIONES.md.
    if (
      verification.contentType !== undefined &&
      verification.contentType !== contentType.toString()
    ) {
      await this.storageProvider
        .deleteObject({ storageRef: command.storageRef })
        .catch(() => undefined);
      throw new UnsupportedContentTypeError(verification.contentType);
    }

    // Medicion real (lo que storage recibio via HeadObjectCommand), no un tamano declarado
    // por el cliente - mismo criterio que la validacion de contentType de arriba: ninguno
    // de los dos se confia del lado del cliente.
    if (
      verification.sizeBytes !== undefined &&
      verification.sizeBytes > this.storageLimits.maxUploadBytes
    ) {
      // Best-effort: el objeto ya existe en storage pero se rechaza como File - un fallo de
      // limpieza no bloquea el error de negocio (docs/contracts/05-INTEGRATION-CONTRACTS.md
      // SS3, mismo criterio ya aceptado para cualquier confirmUpload fallido).
      await this.storageProvider
        .deleteObject({ storageRef: command.storageRef })
        .catch(() => undefined);
      throw new FileTooLargeError(verification.sizeBytes, this.storageLimits.maxUploadBytes);
    }

    const file = File.create({
      companyId: command.companyId,
      storageRef: StorageRef.from(command.storageRef),
      contentType,
      uploadedBy: command.uploadedBy,
    });

    await this.unitOfWork.run(async (tx) => {
      await this.fileRepository.save(file, tx);
      for (const event of file.pullDomainEvents()) {
        await this.eventPublisher.publish(tx, {
          eventType: event.eventType,
          aggregateType: 'File',
          aggregateId: file.id.toString(),
          companyId: command.companyId,
          payload: { ...event },
        });
      }
    });

    return file.id;
  }
}
