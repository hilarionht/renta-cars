import { Injectable } from '@nestjs/common';

import { ReadTransaction } from '@platform/persistence-kernel';
import type { GetVehicleCategoryQuery, VehicleCategoryDetail } from '@rental/vehicles/application';
import { VehicleCategoryNotFoundError } from '@rental/vehicles/domain';

@Injectable()
export class GetVehicleCategoryHandler {
  constructor(private readonly readTransaction: ReadTransaction) {}

  async execute(query: GetVehicleCategoryQuery): Promise<VehicleCategoryDetail> {
    const record = await this.readTransaction.run(
      (tx) =>
        tx.vehicleCategory.findFirst({
          where: { id: query.vehicleCategoryId },
          include: { rates: true },
        }),
      query.companyId,
    );

    if (!record) {
      throw new VehicleCategoryNotFoundError(query.vehicleCategoryId);
    }

    return {
      id: record.id,
      companyId: record.companyId,
      name: record.name,
      description: record.description ?? undefined,
      rates: record.rates.map((rate) => ({
        id: rate.id,
        amountMinorUnits: rate.amountMinorUnits,
        currency: rate.currency,
        unit: rate.unit,
        validFrom: rate.validFrom.toISOString(),
        validTo: rate.validTo?.toISOString(),
      })),
    };
  }
}
