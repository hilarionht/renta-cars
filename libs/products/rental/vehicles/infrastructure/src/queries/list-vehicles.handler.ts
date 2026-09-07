import { Inject, Injectable } from '@nestjs/common';
import type { VehicleStatus } from '@prisma/client';

import { ReadTransaction } from '@platform/persistence-kernel';
import { UnsupportedExpandError } from '@platform/shared-kernel';
import { CALENDAR_PORT, type CalendarPort } from '@platform/calendar/application';
import { InvalidDateRangeError } from '@rental/vehicles/domain';
import type { ListVehiclesQuery, VehicleSummary } from '@rental/vehicles/application';

// docs/persistence/10-DECISIONES.md Fase 4 item 1 (fleet-utilization.handler.ts): misma
// flota "operable" que un reporte de utilizacion considera - excluida del denominador ahi,
// excluida de la busqueda aca, mismo criterio, duplicado deliberado (sin constante
// compartida entre reports y vehicles, modulos distintos).
const UNAVAILABLE_VEHICLE_STATUSES = ['OutOfService', 'Maintenance'] as const;

// docs/persistence/10-DECISIONES.md #123 - primera implementacion real de `?expand=`, un
// solo valor soportado hoy. Sin parser generico (un solo endpoint, un solo valor) - agregar
// un 2do valor es un `.split(',')` en el DTO/controller, no una migracion de contrato.
const SUPPORTED_EXPAND_VALUES = ['vehicleCategory'] as const;

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
    for (const value of query.expand ?? []) {
      if (!SUPPORTED_EXPAND_VALUES.includes(value as (typeof SUPPORTED_EXPAND_VALUES)[number])) {
        throw new UnsupportedExpandError(value, [...SUPPORTED_EXPAND_VALUES]);
      }
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

    if (query.expand?.includes('vehicleCategory') && summaries.length > 0) {
      const categoryIds = [...new Set(summaries.map((summary) => summary.vehicleCategoryId))];
      const categories = await this.readTransaction.run(
        (tx) =>
          tx.vehicleCategory.findMany({
            where: { id: { in: categoryIds } },
            select: { id: true, name: true },
          }),
        query.companyId,
      );
      const categoryById = new Map(categories.map((category) => [category.id, category]));
      return summaries.map((summary) => ({
        ...summary,
        vehicleCategory: categoryById.get(summary.vehicleCategoryId),
      }));
    }

    return summaries;
  }
}
