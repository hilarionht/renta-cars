import { DomainError } from '@platform/shared-kernel';

export class VehicleDocumentExpiredError extends DomainError {
  constructor(documentId: string) {
    super(`El vehicle document "${documentId}" esta vencido.`);
  }
}
