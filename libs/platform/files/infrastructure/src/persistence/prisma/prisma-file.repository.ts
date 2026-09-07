import { Injectable } from '@nestjs/common';
import { Prisma, type File as PrismaFile } from '@prisma/client';

import {
  ConcurrentModificationError,
  EntityId,
  type UnitOfWorkTransaction,
} from '@platform/shared-kernel';
import { asPrismaTransaction, ReadTransaction } from '@platform/persistence-kernel';
import {
  ContentType,
  File,
  type FileId,
  FileAlreadyConfirmedError,
  StorageRef,
} from '@platform/files/domain';
import type { FileRepository } from '@platform/files/application';

const UNIQUE_CONSTRAINT_VIOLATION = 'P2002';

@Injectable()
export class PrismaFileRepository implements FileRepository {
  constructor(private readonly readTransaction: ReadTransaction) {}

  async findById(id: FileId): Promise<File | null> {
    const record = await this.readTransaction.run((tx) =>
      tx.file.findFirst({ where: { id: id.toString() } }),
    );
    return record ? this.toDomain(record) : null;
  }

  async save(file: File, tx: UnitOfWorkTransaction): Promise<void> {
    const prisma = asPrismaTransaction(tx);
    const data = {
      companyId: file.companyId,
      storageRef: file.storageRef.toString(),
      contentType: file.contentType.toString(),
      uploadStatus: file.uploadStatus,
      uploadedBy: file.uploadedBy,
    };

    try {
      if (file.isNew) {
        await prisma.file.create({
          data: { id: file.id.toString(), ...data, version: file.version },
        });
        file.markPersisted();
        return;
      }

      const result = await prisma.file.updateMany({
        where: { id: file.id.toString(), version: file.version - 1 },
        data: { ...data, version: file.version },
      });

      if (result.count === 0) {
        throw new ConcurrentModificationError('File', file.id.toString());
      }
    } catch (error) {
      // storage_ref es UNIQUE - un segundo confirmUpload con la misma referencia (retry de
      // red) dispara este constraint, no un pre-check (mismo criterio que
      // DuplicateTaxIdError en PrismaCompanyRepository).
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === UNIQUE_CONSTRAINT_VIOLATION
      ) {
        throw new FileAlreadyConfirmedError(file.storageRef.toString());
      }
      throw error;
    }
  }

  private toDomain(record: PrismaFile): File {
    return File.reconstitute({
      id: EntityId.from<'File'>(record.id),
      companyId: record.companyId,
      storageRef: StorageRef.from(record.storageRef),
      contentType: ContentType.from(record.contentType),
      uploadStatus: record.uploadStatus,
      uploadedBy: record.uploadedBy,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      version: record.version,
    });
  }
}
