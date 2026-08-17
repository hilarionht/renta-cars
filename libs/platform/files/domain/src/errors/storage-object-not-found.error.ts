import { DomainError } from '@platform/shared-kernel';

// ConfirmUpload llamo a verifyUploadedObject (HEAD) y el objeto no existe en storage - el
// cliente nunca hizo el PUT, o lo hizo contra una storageRef distinta a la devuelta por
// getUploadUrl.
export class StorageObjectNotFoundError extends DomainError {
  constructor(storageRef: string) {
    super(`No existe ningun objeto subido para la referencia de storage "${storageRef}".`);
  }
}
