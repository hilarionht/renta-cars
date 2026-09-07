import { Injectable } from '@nestjs/common';

import { ReadTransaction } from '@platform/persistence-kernel';
import type { GetVehicleQuery, VehicleDetail } from '@rental/vehicles/application';
import { VehicleNotFoundError } from '@rental/vehicles/domain';

@Injectable()
export class GetVehicleHandler {
  constructor(private readonly readTransaction: ReadTransaction) {}

  async execute(query: GetVehicleQuery): Promise<VehicleDetail> {
    const record = await this.readTransaction.run(
      (tx) =>
        tx.vehicle.findFirst({
          where: { id: query.vehicleId },
          include: { vehicleDocuments: true, maintenanceRecords: true },
        }),
      query.companyId,
    );

    if (!record) {
      throw new VehicleNotFoundError(query.vehicleId);
    }

    return {
      id: record.id,
      companyId: record.companyId,
      branchId: record.branchId,
      vehicleCategoryId: record.vehicleCategoryId,
      licensePlate: record.licensePlate,
      vin: record.vin,
      status: record.status,
      vehicleDocuments: record.vehicleDocuments.map((document) => ({
        id: document.id,
        documentType: document.documentType,
        fileId: document.fileId,
        expiryDate: document.expiryDate.toISOString(),
        status: document.status,
      })),
      maintenanceRecords: record.maintenanceRecords.map((maintenance) => ({
        id: maintenance.id,
        type: maintenance.type,
        status: maintenance.status,
        scheduledStart: maintenance.scheduledStart.toISOString(),
        scheduledEnd: maintenance.scheduledEnd.toISOString(),
        fitForService: maintenance.fitForService ?? undefined,
      })),
    };
  }
}
