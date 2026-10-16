import { Injectable } from '@nestjs/common';

import type { UnitOfWorkTransaction } from '@platform/shared-kernel';
import { asPrismaTransaction, ReadTransaction } from '@platform/persistence-kernel';
import type { VehicleStatusPort } from '@rental/vehicles/application';

// Consumido por Reservation (Fase 1 item 4, todavia no construido) - INV-103, mismo
// criterio de lectura liviana que PrismaCustomerLookupAdapter.
@Injectable()
export class PrismaVehicleStatusAdapter implements VehicleStatusPort {
  constructor(private readonly readTransaction: ReadTransaction) {}

  async isOperational(vehicleId: string, tx?: UnitOfWorkTransaction): Promise<boolean | null> {
    const query = { where: { id: vehicleId }, select: { status: true } };
    const record = tx
      ? await asPrismaTransaction(tx).vehicle.findFirst(query)
      : await this.readTransaction.run((readTx) => readTx.vehicle.findFirst(query));
    if (!record) {
      return null;
    }
    return record.status !== 'Maintenance' && record.status !== 'OutOfService';
  }

  async getBranchId(vehicleId: string, tx?: UnitOfWorkTransaction): Promise<string | null> {
    const query = { where: { id: vehicleId }, select: { branchId: true } };
    const record = tx
      ? await asPrismaTransaction(tx).vehicle.findFirst(query)
      : await this.readTransaction.run((readTx) => readTx.vehicle.findFirst(query));
    return record?.branchId ?? null;
  }

  async getCategoryId(vehicleId: string): Promise<string | null> {
    const record = await this.readTransaction.run((tx) =>
      tx.vehicle.findFirst({ where: { id: vehicleId }, select: { vehicleCategoryId: true } }),
    );
    return record?.vehicleCategoryId ?? null;
  }
}
