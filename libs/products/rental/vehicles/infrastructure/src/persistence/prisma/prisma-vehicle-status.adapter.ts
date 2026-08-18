import { Injectable } from '@nestjs/common';

import { ReadTransaction } from '@platform/persistence-kernel';
import type { VehicleStatusPort } from '@rental/vehicles/application';

// Consumido por Reservation (Fase 1 item 4, todavia no construido) - INV-103, mismo
// criterio de lectura liviana que PrismaCustomerLookupAdapter.
@Injectable()
export class PrismaVehicleStatusAdapter implements VehicleStatusPort {
  constructor(private readonly readTransaction: ReadTransaction) {}

  async isOperational(vehicleId: string): Promise<boolean | null> {
    const record = await this.readTransaction.run((tx) =>
      tx.vehicle.findFirst({ where: { id: vehicleId }, select: { status: true } }),
    );
    if (!record) {
      return null;
    }
    return record.status !== 'Maintenance' && record.status !== 'OutOfService';
  }
}
