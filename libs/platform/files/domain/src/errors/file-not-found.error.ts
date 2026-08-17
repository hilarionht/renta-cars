import { DomainError } from '@platform/shared-kernel';

export class FileNotFoundError extends DomainError {
  constructor(fileId: string) {
    super(`No existe el archivo "${fileId}".`);
  }
}
