import { Injectable } from '@nestjs/common';
import { Prisma, type Company as PrismaCompany } from '@prisma/client';

import {
  ConcurrentModificationError,
  EntityId,
  type UnitOfWorkTransaction,
} from '@platform/shared-kernel';
import { asPrismaTransaction, ReadTransaction } from '@platform/persistence-kernel';
import {
  BillingContact,
  Company,
  type CompanyId,
  DuplicateTaxIdError,
  LegalName,
  TaxId,
} from '@platform/companies/domain';
import type { CompanyRepository } from '@platform/companies/application';

const UNIQUE_CONSTRAINT_VIOLATION = 'P2002';

@Injectable()
export class PrismaCompanyRepository implements CompanyRepository {
  constructor(private readonly readTransaction: ReadTransaction) {}

  async findById(id: CompanyId): Promise<Company | null> {
    const record = await this.readTransaction.run((tx) =>
      tx.company.findFirst({ where: { id: id.toString() } }),
    );
    return record ? this.toDomain(record) : null;
  }

  async save(company: Company, tx: UnitOfWorkTransaction): Promise<void> {
    const prisma = asPrismaTransaction(tx);
    const data = {
      legalName: company.legalName.toString(),
      taxId: company.taxId.toString(),
      billingContactEmail: company.billingContact.toEmail().toString(),
      billingContactPhone: company.billingContact.toPhone(),
      status: company.status,
    };

    try {
      if (company.isNew) {
        await prisma.company.create({
          data: { id: company.id.toString(), ...data, version: company.version },
        });
        company.markPersisted();
        return;
      }

      const result = await prisma.company.updateMany({
        where: { id: company.id.toString(), version: company.version - 1 },
        data: { ...data, version: company.version },
      });

      if (result.count === 0) {
        throw new ConcurrentModificationError('Company', company.id.toString());
      }
    } catch (error) {
      // INV-016: TaxId unico a nivel de Plataforma. Un pre-check por SELECT cruzaria RLS de
      // companies (solo deja ver "la propia" - ninguna al momento del registro), asi que la
      // unicidad se valida atrapando el constraint de Postgres, no antes - ver
      // docs/persistence/10-DECISIONES.md.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === UNIQUE_CONSTRAINT_VIOLATION
      ) {
        throw new DuplicateTaxIdError(company.taxId.toString());
      }
      throw error;
    }
  }

  private toDomain(record: PrismaCompany): Company {
    return Company.reconstitute({
      id: EntityId.from<'Company'>(record.id),
      legalName: LegalName.from(record.legalName),
      taxId: TaxId.from(record.taxId),
      billingContact: BillingContact.from({
        email: record.billingContactEmail,
        phone: record.billingContactPhone ?? undefined,
      }),
      status: record.status,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      version: record.version,
    });
  }
}
