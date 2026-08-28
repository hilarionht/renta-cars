import { Inject, Injectable } from '@nestjs/common';
import type { VehicleStatus } from '@prisma/client';

import { ReadTransaction } from '@platform/persistence-kernel';
import { CALENDAR_PORT, type CalendarPort } from '@platform/calendar/application';
import { InvalidDateRangeError } from '@rental/vehicles/domain';
import type { ListVehiclesQuery, VehicleSummary } from '@rental/vehicles/application';

// docs/persistence/10-DECISIONES.md Fase 4 item 1 (fleet-utilization.handler.ts): misma
// flota "operable" que un reporte de utilizacion considera - excluida del denominador ahi,
// excluida de la busqueda aca, mismo criterio, duplicado deliberado (sin constante
// compartida entre reports y vehicles, modulos distintos).
const UNAVAILABLE_VEHICLE_STATUSES = ['OutOfService', 'Maintenance'] as const;

@Injectable()
export class ListVehiclesHandler {
  constructor(
    private readonly readTransaction: ReadTransaction,
    @Inject(CALENDAR_PORT) private readonly calendarPort: CalendarPort,
  ) {}

  async execute(query: ListVehiclesQuery): Promise<VehicleSummary[]> {
    const searchingAvailability = query.startDate !== undefined && query.endDate !== undefined;
    if (searchingAvailability && query.startDate! >= query.endDate!) {
      throw new InvalidDateRangeError(query.startDate!.toISOString(), query.endDate!.toISOString());
    }

    const records = await this.readTransaction.run(
      (tx) =>
        tx.vehicle.findMany({
          where: {
            companyId: query.companyId,
            branchId: query.branchId,
            status: searchingAvailability
              ? { notIn: [...UNAVAILABLE_VEHICLE_STATUSES] }
              : (query.status as VehicleStatus | undefined),
          },
        }),
      query.companyId,
    );

    let summaries = records.map((record) => ({
      id: record.id,
      branchId: record.branchId,
      vehicleCategoryId: record.vehicleCategoryId,
      licensePlate: record.licensePlate,
      vin: record.vin,
      status: record.status,
    }));

    if (searchingAvailability) {
      const occupiedIds = await this.calendarPort.findOccupiedResourceIds(
        'vehicle',
        summaries.map((summary) => summary.id),
        query.startDate!,
        query.endDate!,
      );
      summaries = summaries.filter((summary) => !occupiedIds.includes(summary.id));
    }

    return summaries;
  }
}
