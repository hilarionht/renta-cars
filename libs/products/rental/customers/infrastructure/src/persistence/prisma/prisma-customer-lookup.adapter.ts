import { Injectable } from '@nestjs/common';

import { ReadTransaction } from '@platform/persistence-kernel';
import type { CustomerLookupPort } from '@rental/customers/application';

// Consumido por Reservation (Fase 1, todavia no construido) - corre despues de
// TenantContextGuard, ReadTransaction ambiente alcanza. Reimplementa el predicado de
// Customer.isEligibleForConfirmation() con una query directa (no reconstituye el aggregate
// completo) - mismo criterio de lectura liviana que otros *LookupAdapter ya construidos.
@Injectable()
export class PrismaCustomerLookupAdapter implements CustomerLookupPort {
  constructor(private readonly readTransaction: ReadTransaction) {}

  async isEligibleForConfirmation(customerId: string): Promise<boolean | null> {
    const record = await this.readTransaction.run((tx) =>
      tx.customer.findFirst({
        where: { id: customerId },
        select: {
          status: true,
          blockStatus: true,
          identityDocuments: {
            where: { customerId },
            select: { status: true, expiryDate: true },
          },
        },
      }),
    );
    if (!record) {
      return null;
    }
    if (record.status !== 'Active' || record.blockStatus === 'Blocked') {
      return false;
    }
    const now = new Date();
    return record.identityDocuments.some(
      (document) => document.status === 'Verified' && document.expiryDate > now,
    );
  }

  async areAdditionalDriversValidated(driverIds: string[]): Promise<boolean> {
    if (driverIds.length === 0) {
      return true;
    }
    const records = await this.readTransaction.run((tx) =>
      tx.additionalDriver.findMany({
        where: { id: { in: driverIds } },
        select: { id: true, status: true },
      }),
    );
    if (records.length !== driverIds.length) {
      return false;
    }
    return records.every((record) => record.status === 'Validated');
  }
}
