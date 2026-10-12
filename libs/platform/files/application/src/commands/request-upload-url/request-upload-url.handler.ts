import { Inject, Injectable } from '@nestjs/common';

import { ContentType } from '@platform/files/domain';

import { STORAGE_PROVIDER_PORT, type StorageProviderPort } from '../../ports/storage-provider.port';
import type { RequestUploadUrlCommand, RequestUploadUrlResult } from './request-upload-url.command';

// Ningun estado se persiste aca todavia (nada que guardar hasta que el binario exista en
// storage) - solo una llamada en vivo al puerto. companyId/uploadedBy vienen del command
// (poblados por el controller desde RequestContext), nunca del body del cliente
// (docs/contracts/03-REQUEST-RESPONSE-STANDARDS.md SS1.1).
@Injectable()
export class RequestUploadUrlHandler {
  constructor(
    @Inject(STORAGE_PROVIDER_PORT) private readonly storageProvider: StorageProviderPort,
  ) {}

  async execute(command: RequestUploadUrlCommand): Promise<RequestUploadUrlResult> {
    // ContentType.from() valida el allowlist ANTES de tocar el puerto de storage - rechazo
    // barato, sin llamada externa de por medio.
    const contentType = ContentType.from(command.contentType);

    return this.storageProvider.getUploadUrl({
      companyId: command.companyId,
      contentType: contentType.toString(),
      uploadedBy: command.uploadedBy,
    });
  }
}
