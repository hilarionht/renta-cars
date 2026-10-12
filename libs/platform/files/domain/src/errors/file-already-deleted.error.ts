import { DomainError } from '@platform/shared-kernel';

// Regla de docs/model/02-AGGREGATES.md SS15: un File en Deleted no puede generar una nueva
// URL firmada - por simetria, tampoco puede volver a eliminarse. Guarda compartida por
// delete() y ensureReadable() en la entidad File.
export class FileAlreadyDeletedError extends DomainError {
  constructor(fileId: string) {
    super(`El archivo "${fileId}" ya fue eliminado.`);
  }
}
