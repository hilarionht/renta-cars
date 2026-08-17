import { DomainError } from '@platform/shared-kernel';

// storage_ref es UNIQUE a nivel de DB - un segundo confirmUpload con la misma referencia
// (p. ej. un retry de red del cliente) dispara P2002. Se traduce aca, mismo patron que
// DuplicateTaxIdError en PrismaCompanyRepository.save().
export class FileAlreadyConfirmedError extends DomainError {
  constructor(storageRef: string) {
    super(`Ya existe un archivo confirmado para la referencia de storage "${storageRef}".`);
  }
}
