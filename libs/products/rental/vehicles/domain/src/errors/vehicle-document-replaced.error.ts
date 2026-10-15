import { DomainError } from '@platform/shared-kernel';

// docs/persistence/10-DECISIONES.md #139: un documento ya reemplazado por una renovacion no se
// puede verificar.
export class VehicleDocumentReplacedError extends DomainError {
  constructor(documentId: string) {
    super(`El vehicle document "${documentId}" fue reemplazado por uno mas nuevo.`);
  }
}
