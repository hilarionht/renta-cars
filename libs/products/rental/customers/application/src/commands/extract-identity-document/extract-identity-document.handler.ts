import { Inject, Injectable, Logger } from '@nestjs/common';

import {
  DOCUMENT_EXTRACTION_PORT,
  type DocumentExtractionPort,
  type ExtractedDocumentFields,
} from '@platform/files/application';

import type { ExtractIdentityDocumentCommand } from './extract-identity-document.command';

// Vive en commands/ pese a no mutar ningun aggregate - mismo patron "Handler + puerto
// inyectado" que el resto de esta capa (ValidateAdditionalDriverLicenseHandler); las queries
// de esta capa son solo interfaces, sus Handlers reales viven en infrastructure/ contra
// Prisma directo, nunca contra un puerto de aplicacion.
//
// docs/contracts/05-INTEGRATION-CONTRACTS.md SS4: "un fallo de extraccion... nunca bloquea el
// registro manual del cliente - degrada a captura 100% manual, nunca es un error que impida
// continuar el proceso de negocio". Por eso null en vez de propagar - el operador simplemente
// sigue con UploadIdentityDocumentHandler sin sugerencia. Mismo criterio ya usado para fileId
// en ese mismo handler: se confia tal cual, sin verificar contra Files.
@Injectable()
export class ExtractIdentityDocumentHandler {
  private readonly logger = new Logger(ExtractIdentityDocumentHandler.name);

  constructor(
    @Inject(DOCUMENT_EXTRACTION_PORT)
    private readonly documentExtractionPort: DocumentExtractionPort,
  ) {}

  async execute(command: ExtractIdentityDocumentCommand): Promise<ExtractedDocumentFields | null> {
    try {
      return await this.documentExtractionPort.extract(command.fileId);
    } catch (error) {
      this.logger.warn(
        `No se pudo extraer datos del documento "${command.fileId}" via OCR, degradando a captura manual: ${String(error)}`,
      );
      return null;
    }
  }
}
