import { DomainError } from '@platform/shared-kernel';

// docs/persistence/10-DECISIONES.md #139: un documento ya reemplazado por una renovacion no se
// puede verificar (el vigente es el nuevo).
export class IdentityDocumentReplacedError extends DomainError {
  constructor(documentId: string) {
    super(`El identity document "${documentId}" fue reemplazado por uno mas nuevo.`);
  }
}
