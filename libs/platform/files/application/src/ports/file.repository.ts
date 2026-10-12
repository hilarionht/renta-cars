import type { UnitOfWorkTransaction } from '@platform/shared-kernel';
import type { File, FileId } from '@platform/files/domain';

export const FILE_REPOSITORY = Symbol('FileRepository');

export interface FileRepository {
  findById(id: FileId): Promise<File | null>;
  // Lanza FileAlreadyConfirmedError al atrapar el constraint unico de storage_ref
  // (Postgres P2002) - mismo patron que DuplicateTaxIdError en CompanyRepository.
  save(file: File, tx: UnitOfWorkTransaction): Promise<void>;
}
