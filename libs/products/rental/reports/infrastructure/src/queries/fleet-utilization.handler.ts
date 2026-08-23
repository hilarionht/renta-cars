import { Injectable } from '@nestjs/common';

import { ReadTransaction } from '@platform/persistence-kernel';
import { InvalidReportRangeError } from '@rental/reports/application';
import type {
  FleetUtilizationItem,
  FleetUtilizationQuery,
  FleetUtilizationResult,
} from '@rental/reports/application';

import { overlapDays } from './overlap-days';

const MS_PER_DAY = 24 * 60 * 60 * 1000;
// Decision del usuario (docs/persistence/10-DECISIONES.md Fase 4, item 1): el denominador es
// la flota operativamente disponible - vehiculos OutOfService/Maintenance quedan excluidos,
// el % refleja "de lo que podiamos rentar, cuanto rentamos", no penaliza por flota en taller.
const UNAVAILABLE_VEHICLE_STATUSES = ['OutOfService', 'Maintenance'] as const;

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

// AvailabilitySlot.resourceId es opaco (Scheduling deliberadamente ciego a que es un
// Vehicle, docs/persistence/03-RELACIONES.md) - sin FK, el cruce con Vehicle.id se resuelve
// aca con un Map en JS, nunca con un join de Postgres.
@Injectable()
export class FleetUtilizationHandler {
  constructor(private readonly readTransaction: ReadTransaction) {}

  async execute(query: FleetUtilizationQuery): Promise<FleetUtilizationResult> {
    if (query.from > query.to) {
      throw new InvalidReportRangeError(query.from, query.to);
    }

    const rangeStart = new Date(query.from);
    const rangeEnd = new Date(query.to);
    const totalDays = Math.max((rangeEnd.getTime() - rangeStart.getTime()) / MS_PER_DAY, 0);

    const { vehicles, slots } = await this.readTransaction.run(async (tx) => {
      const vehicleRecords = await tx.vehicle.findMany({
        where: { status: { notIn: [...UNAVAILABLE_VEHICLE_STATUSES] } },
        select: { id: true, branchId: true },
      });
      const slotRecords = await tx.availabilitySlot.findMany({
        where: {
          resourceType: 'Vehicle',
          slotType: 'Booking',
          status: 'Active',
          startDate: { lte: rangeEnd },
          endDate: { gte: rangeStart },
        },
        select: { resourceId: true, startDate: true, endDate: true },
      });
      return { vehicles: vehicleRecords, slots: slotRecords };
    }, query.companyId);

    const occupiedDaysByVehicle = new Map<string, number>();
    for (const slot of slots) {
      const days = overlapDays(slot.startDate, slot.endDate, rangeStart, rangeEnd);
      occupiedDaysByVehicle.set(
        slot.resourceId,
        (occupiedDaysByVehicle.get(slot.resourceId) ?? 0) + days,
      );
    }

    const items: FleetUtilizationItem[] = vehicles.map((vehicle) => {
      const occupiedDays = occupiedDaysByVehicle.get(vehicle.id) ?? 0;
      return {
        vehicleId: vehicle.id,
        branchId: vehicle.branchId,
        occupiedDays,
        totalDays,
        utilizationPercentage: totalDays > 0 ? round1((occupiedDays / totalDays) * 100) : 0,
      };
    });

    const totalOccupiedDays = items.reduce((sum, item) => sum + item.occupiedDays, 0);
    const totalAvailableDays = vehicles.length * totalDays;
    const fleetAverageUtilizationPercentage =
      totalAvailableDays > 0 ? round1((totalOccupiedDays / totalAvailableDays) * 100) : 0;

    return { fleetAverageUtilizationPercentage, items };
  }
}
