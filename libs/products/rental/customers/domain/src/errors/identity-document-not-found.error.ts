import { DomainError } from '@platform/shared-kernel';

export class IdentityDocumentNotFoundError extends DomainError {
  constructor(documentId: string) {
    super(`No existe el identity document "${documentId}".`);
  }
}
