import { Injectable } from '@nestjs/common';
import type { Branch as PrismaBranch } from '@prisma/client';

import {
  ConcurrentModificationError,
  EntityId,
  type UnitOfWorkTransaction,
} from '@platform/shared-kernel';
import { asPrismaTransaction, ReadTransaction } from '@platform/persistence-kernel';
import {
  Address,
  Branch,
  type BranchId,
  BranchName,
  type DaySchedule,
  OperatingHours,
} from '@platform/branches/domain';
import type { BranchRepository } from '@platform/branches/application';

@Injectable()
export class PrismaBranchRepository implements BranchRepository {
  constructor(private readonly readTransaction: ReadTransaction) {}

  async findById(id: BranchId): Promise<Branch | null> {
    const record = await this.readTransaction.run((tx) =>
      tx.branch.findFirst({ where: { id: id.toString() } }),
    );
    return record ? this.toDomain(record) : null;
  }

  async findAllForCompany(companyId: string): Promise<Branch[]> {
    const records = await this.readTransaction.run(
      (tx) => tx.branch.findMany({ where: { companyId } }),
      companyId,
    );
    return records.map((record) => this.toDomain(record));
  }

  async save(branch: Branch, tx: UnitOfWorkTransaction): Promise<void> {
    const prisma = asPrismaTransaction(tx);
    const address = branch.address.toProps();
    const data = {
      companyId: branch.companyId,
      name: branch.name.toString(),
      addressLine1: address.line1,
      addressLine2: address.line2,
      addressCity: address.city,
      addressStateProvince: address.stateProvince,
      addressPostalCode: address.postalCode,
      addressCountry: address.country,
      operatingHours: branch.operatingHours.toSchedule() as unknown as object,
      status: branch.status,
    };

    if (branch.isNew) {
      await prisma.branch.create({
        data: { id: branch.id.toString(), ...data, version: branch.version },
      });
      branch.markPersisted();
      return;
    }

    const result = await prisma.branch.updateMany({
      where: { id: branch.id.toString(), version: branch.version - 1 },
      data: { ...data, version: branch.version },
    });

    if (result.count === 0) {
      throw new ConcurrentModificationError('Branch', branch.id.toString());
    }
  }

  private toDomain(record: PrismaBranch): Branch {
    return Branch.reconstitute({
      id: EntityId.from<'Branch'>(record.id),
      companyId: record.companyId,
      name: BranchName.from(record.name),
      address: Address.from({
        line1: record.addressLine1,
        line2: record.addressLine2 ?? undefined,
        city: record.addressCity,
        stateProvince: record.addressStateProvince ?? undefined,
        postalCode: record.addressPostalCode ?? undefined,
        country: record.addressCountry,
      }),
      operatingHours: OperatingHours.from(record.operatingHours as unknown as DaySchedule[]),
      status: record.status,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      version: record.version,
    });
  }
}
