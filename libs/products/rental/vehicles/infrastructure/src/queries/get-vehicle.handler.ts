import { Injectable } from '@nestjs/common';

import { ReadTransaction } from '@platform/persistence-kernel';
import type { GetVehicleQuery, VehicleDetail } from '@rental/vehicles/application';
import { VehicleNotFoundError } from '@rental/vehicles/domain';

import { loadActiveReservations, withOverdueFlag } from './vehicle-reservations.read';

@Injectable()
export class GetVehicleHandler {
  constructor(private readonly readTransaction: ReadTransaction) {}

  async execute(query: GetVehicleQuery): Promise<VehicleDetail> {
    const loaded = await this.readTransaction.run(async (tx) => {
      const vehicle = await tx.vehicle.findFirst({
        where: { id: query.vehicleId },
        include: {
          vehicleDocuments: { orderBy: { createdAt: 'asc' } },
          maintenanceRecords: { orderBy: { scheduledStart: 'asc' } },
        },
      });
      if (!vehicle) {
        return null;
      }
      // docs/persistence/10-DECISIONES.md #137: reservas activas, solo para el personal.
      const reservations = query.includeReservations
        ? await loadActiveReservations(tx, [vehicle.id])
        : undefined;
      return { vehicle, reservations };
    }, query.companyId);

    if (!loaded) {
      throw new VehicleNotFoundError(query.vehicleId);
    }
    const { vehicle: record, reservations } = loaded;

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
      ...(reservations
        ? { activeReservations: withOverdueFlag(reservations.get(record.id), new Date()) }
        : {}),
    };
  }
}
