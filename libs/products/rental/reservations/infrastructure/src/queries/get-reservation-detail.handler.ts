import { Injectable } from '@nestjs/common';

import { ReadTransaction } from '@platform/persistence-kernel';
import type {
  GetReservationDetailQuery,
  ReservationDetail,
} from '@rental/reservations/application';
import { ReservationNotFoundError } from '@rental/reservations/domain';

import { loadReservationExpansions, parseReservationExpand } from './reservation-expand';

// docs/persistence/10-DECISIONES.md #135: detalle para el personal (GET /reservations/:id).
// Handler aparte de GetReservationHandler a proposito: ese lo comparte /me/reservations/:id y
// no debe exponer inspecciones ni danos al cliente.
@Injectable()
export class GetReservationDetailHandler {
  constructor(private readonly readTransaction: ReadTransaction) {}

  async execute(query: GetReservationDetailQuery): Promise<ReservationDetail> {
    const expand = parseReservationExpand(query.expand);

    const loaded = await this.readTransaction.run(async (tx) => {
      const record = await tx.reservation.findFirst({
        where: { id: query.reservationId },
        include: {
          authorizedDrivers: { select: { additionalDriverId: true } },
          inspections: { orderBy: { inspectedAt: 'asc' } },
          damageReports: { orderBy: { createdAt: 'asc' } },
          priceAdjustments: { orderBy: { createdAt: 'asc' } },
        },
      });
      if (!record) {
        return null;
      }
      const expansions = await loadReservationExpansions(tx, [record], expand);
      return { record, expansions: expansions.get(record.id) };
    }, query.companyId);

    if (!loaded) {
      throw new ReservationNotFoundError(query.reservationId);
    }
    const { record, expansions } = loaded;

    return {
      id: record.id,
      customerId: record.customerId,
      vehicleId: record.vehicleId,
      status: record.status,
      startDate: record.startDate.toISOString(),
      endDate: record.endDate.toISOString(),
      baseAmountMinorUnits: record.baseAmountMinorUnits,
      currency: record.baseAmountCurrency,
      authorizedDriverIds: record.authorizedDrivers.map((driver) => driver.additionalDriverId),
      ...expansions,
      inspections: record.inspections.map((inspection) => ({
        id: inspection.id,
        type: inspection.type,
        odometer: inspection.odometer,
        fuelLevel: inspection.fuelLevel,
        inspectedAt: inspection.inspectedAt.toISOString(),
        inspectedBy: inspection.inspectedBy,
      })),
      damageReports: record.damageReports.map((damage) => ({
        id: damage.id,
        inspectionId: damage.inspectionId,
        description: damage.description,
        severity: damage.severity,
        imputableToCustomer: damage.imputableToCustomer,
        createdAt: damage.createdAt.toISOString(),
      })),
      priceAdjustments: record.priceAdjustments.map((adjustment) => ({
        id: adjustment.id,
        kind: adjustment.kind,
        amountMinorUnits: adjustment.amountMinorUnits,
        currency: adjustment.currency,
        reason: adjustment.reason ?? undefined,
        createdAt: adjustment.createdAt.toISOString(),
      })),
    };
  }
}
