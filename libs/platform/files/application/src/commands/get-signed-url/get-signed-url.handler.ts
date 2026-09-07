import { Inject, Injectable } from '@nestjs/common';

import { EntityId } from '@platform/shared-kernel';
import { type FileId, FileNotFoundError } from '@platform/files/domain';

import { FILE_REPOSITORY, type FileRepository } from '../../ports/file.repository';
import { STORAGE_PROVIDER_PORT, type StorageProviderPort } from '../../ports/storage-provider.port';
import type { GetSignedUrlCommand, GetSignedUrlResult } from './get-signed-url.command';

// Command, no Query de infrastructure/queries/ (ADR-0007) - a diferencia de
// GetCompanyHandler/ListAuditLogHandler (leen directo de Postgres, sin pasar por el modelo
// de dominio), esto necesita cargar el agregado File real para exigir el invariante "un
// File Deleted no puede generar una nueva URL firmada" y dispara un efecto externo
// no-idempotente (una URL firmada nueva en cada llamada) - ninguna de las dos propiedades
// encaja con la definicion de "Query" de este codebase. No usa UnitOfWork: no hay nada que
// persistir. Ver docs/persistence/10-DECISIONES.md.
@Injectable()
export class GetSignedUrlHandler {
  constructor(
    @Inject(FILE_REPOSITORY) private readonly fileRepository: FileRepository,
    @Inject(STORAGE_PROVIDER_PORT) private readonly storageProvider: StorageProviderPort,
  ) {}

  async execute(command: GetSignedUrlCommand): Promise<GetSignedUrlResult> {
    const fileId: FileId = EntityId.from(command.fileId);
    const file = await this.fileRepository.findById(fileId);
    if (!file || file.companyId !== command.companyId) {
      throw new FileNotFoundError(command.fileId);
    }

    file.ensureReadable();

    return this.storageProvider.getSignedUrl({ storageRef: file.storageRef.toString() });
  }
}
