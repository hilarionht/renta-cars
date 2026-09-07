import { DomainError } from '@platform/shared-kernel';

export class IdentityDocumentExpiredError extends DomainError {
  constructor(documentId: string) {
    super(`El identity document "${documentId}" esta vencido y no puede verificarse.`);
  }
}
