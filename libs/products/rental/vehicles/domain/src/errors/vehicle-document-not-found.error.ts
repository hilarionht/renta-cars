import { DomainError } from '@platform/shared-kernel';

export class VehicleDocumentNotFoundError extends DomainError {
  constructor(documentId: string) {
    super(`No existe el vehicle document "${documentId}".`);
  }
}
