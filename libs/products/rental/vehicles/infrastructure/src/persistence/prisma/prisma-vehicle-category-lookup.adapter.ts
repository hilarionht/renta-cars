import { Injectable } from '@nestjs/common';

import { ReadTransaction } from '@platform/persistence-kernel';
import type { CurrentRate, VehicleCategoryLookupPort } from '@rental/vehicles/application';

// Consumido por Reservation (Fase 1 item 4, todavia no construido) - RN-20 ("la Rate
// vigente al momento de la confirmacion"). validTo null = vigencia abierta.
@Injectable()
export class PrismaVehicleCategoryLookupAdapter implements VehicleCategoryLookupPort {
  constructor(private readonly readTransaction: ReadTransaction) {}

  async getCurrentRate(categoryId: string, asOf: Date): Promise<CurrentRate | null> {
    const record = await this.readTransaction.run((tx) =>
      tx.rate.findFirst({
        where: {
          vehicleCategoryId: categoryId,
          validFrom: { lte: asOf },
          OR: [{ validTo: null }, { validTo: { gt: asOf } }],
        },
        select: { amountMinorUnits: true, currency: true, unit: true },
      }),
    );
    if (!record) {
      return null;
    }
    return {
      amountMinorUnits: record.amountMinorUnits,
      currency: record.currency,
      unit: record.unit,
    };
  }
}
