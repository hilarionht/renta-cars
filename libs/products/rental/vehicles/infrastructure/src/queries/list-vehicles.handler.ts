import { Injectable } from '@nestjs/common';
import type { VehicleStatus } from '@prisma/client';

import { ReadTransaction } from '@platform/persistence-kernel';
import type { ListVehiclesQuery, VehicleSummary } from '@rental/vehicles/application';

@Injectable()
export class ListVehiclesHandler {
  constructor(private readonly readTransaction: ReadTransaction) {}

  async execute(query: ListVehiclesQuery): Promise<VehicleSummary[]> {
    const records = await this.readTransaction.run(
      (tx) =>
        tx.vehicle.findMany({
          where: {
            companyId: query.companyId,
            branchId: query.branchId,
            status: query.status as VehicleStatus | undefined,
          },
        }),
      query.companyId,
    );

    return records.map((record) => ({
      id: record.id,
      branchId: record.branchId,
      vehicleCategoryId: record.vehicleCategoryId,
      licensePlate: record.licensePlate,
      vin: record.vin,
      status: record.status,
    }));
  }
}
