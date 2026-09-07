import { Injectable } from '@nestjs/common';

import { ReadTransaction } from '@platform/persistence-kernel';
import type {
  ListVehicleCategoriesQuery,
  VehicleCategorySummary,
} from '@rental/vehicles/application';

@Injectable()
export class ListVehicleCategoriesHandler {
  constructor(private readonly readTransaction: ReadTransaction) {}

  async execute(query: ListVehicleCategoriesQuery): Promise<VehicleCategorySummary[]> {
    const records = await this.readTransaction.run(
      (tx) => tx.vehicleCategory.findMany({ where: { companyId: query.companyId } }),
      query.companyId,
    );

    return records.map((record) => ({
      id: record.id,
      name: record.name,
      description: record.description ?? undefined,
    }));
  }
}
