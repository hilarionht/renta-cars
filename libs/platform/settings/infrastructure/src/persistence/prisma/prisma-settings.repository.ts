import { Injectable } from '@nestjs/common';
import type {
  CompanySettings as PrismaCompanySettings,
  PaymentMethod as PrismaPaymentMethod,
} from '@prisma/client';

import { ConcurrentModificationError, type UnitOfWorkTransaction } from '@platform/shared-kernel';
import { asPrismaTransaction, ReadTransaction } from '@platform/persistence-kernel';
import { CompanySettings, PaymentMethod } from '@platform/settings/domain';
import type { SettingsRepository } from '@platform/settings/application';

@Injectable()
export class PrismaSettingsRepository implements SettingsRepository {
  constructor(private readonly readTransaction: ReadTransaction) {}

  async findById(companyId: string): Promise<CompanySettings | null> {
    const record = await this.readTransaction.run((tx) =>
      tx.companySettings.findFirst({ where: { companyId } }),
    );
    return record ? this.toDomain(record) : null;
  }

  async save(settings: CompanySettings, tx: UnitOfWorkTransaction): Promise<void> {
    const prisma = asPrismaTransaction(tx);
    const data = {
      enabledProductModules: settings.enabledProductModules,
      // Cast puntual: los valores del VO PaymentMethod coinciden exactamente con el enum de
      // Prisma (mismos 4 literales) - infrastructure/ es el unico lugar donde se abre este
      // tipo opaco, mismo criterio que asPrismaTransaction().
      paymentMethodsEnabled: settings.paymentMethodsEnabled.map(
        (method) => method.toString() as PrismaPaymentMethod,
      ),
    };

    if (settings.isNew) {
      await prisma.companySettings.create({
        data: { companyId: settings.companyId, ...data, version: settings.version },
      });
      settings.markPersisted();
      return;
    }

    const result = await prisma.companySettings.updateMany({
      where: { companyId: settings.companyId, version: settings.version - 1 },
      data: { ...data, version: settings.version },
    });

    if (result.count === 0) {
      throw new ConcurrentModificationError('CompanySettings', settings.companyId);
    }
  }

  private toDomain(record: PrismaCompanySettings): CompanySettings {
    return CompanySettings.reconstitute({
      companyId: record.companyId,
      enabledProductModules: record.enabledProductModules,
      paymentMethodsEnabled: record.paymentMethodsEnabled.map((method) =>
        PaymentMethod.from(method),
      ),
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      version: record.version,
    });
  }
}
