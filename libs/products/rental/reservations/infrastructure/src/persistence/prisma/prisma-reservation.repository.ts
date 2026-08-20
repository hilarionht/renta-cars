import { Injectable } from '@nestjs/common';
import type {
  DamageReport as PrismaDamageReport,
  DamageReportPhoto as PrismaDamageReportPhoto,
  Inspection as PrismaInspection,
  InspectionPhoto as PrismaInspectionPhoto,
  PriceAdjustment as PrismaPriceAdjustment,
  Reservation as PrismaReservation,
} from '@prisma/client';

import { asPrismaTransaction, ReadTransaction } from '@platform/persistence-kernel';
import {
  ConcurrentModificationError,
  DateRange,
  EntityId,
  Money,
  type UnitOfWorkTransaction,
} from '@platform/shared-kernel';
import {
  DamageReport,
  FuelLevel,
  Inspection,
  Odometer,
  PriceAdjustment,
  Reservation,
  type ReservationId,
} from '@rental/reservations/domain';
import type { ReservationRepository } from '@rental/reservations/application';

type ReservationWithChildren = PrismaReservation & {
  inspections: (PrismaInspection & { photos: PrismaInspectionPhoto[] })[];
  damageReports: (PrismaDamageReport & { photos: PrismaDamageReportPhoto[] })[];
  priceAdjustments: PrismaPriceAdjustment[];
  authorizedDrivers: { additionalDriverId: string }[];
};

// Diseno de persistencia con dirty-tracking (docs/persistence/10-DECISIONES.md #36) - mismo
// patron que PrismaVehicleRepository/PrismaCustomerRepository. Inspection/DamageReport/
// PriceAdjustment son verdaderamente append-only (nunca se re-marca dirty un id ya
// guardado), asi que save() usa `create`, no `upsert` - a diferencia de VehicleDocument
// (que si transiciona status post-creacion). authorizedDriverIds se inserta solo cuando
// isNew (fijado integramente en create(), nunca modificado despues).
@Injectable()
export class PrismaReservationRepository implements ReservationRepository {
  constructor(private readonly readTransaction: ReadTransaction) {}

  async findById(id: ReservationId): Promise<Reservation | null> {
    const record = await this.readTransaction.run((tx) =>
      tx.reservation.findFirst({
        where: { id: id.toString() },
        include: {
          inspections: { include: { photos: true } },
          damageReports: { include: { photos: true } },
          priceAdjustments: true,
          authorizedDrivers: { select: { additionalDriverId: true } },
        },
      }),
    );
    return record ? this.toDomain(record) : null;
  }

  async save(reservation: Reservation, tx: UnitOfWorkTransaction): Promise<void> {
    const prisma = asPrismaTransaction(tx);
    const rootData = {
      companyId: reservation.companyId,
      customerId: reservation.customerId,
      vehicleId: reservation.vehicleId,
      status: reservation.status,
      startDate: reservation.dateRange.start,
      endDate: reservation.dateRange.end,
      baseAmountMinorUnits: reservation.baseAmount.minorUnits,
      baseAmountCurrency: reservation.baseAmount.currencyCode,
    };

    if (reservation.isNew) {
      await prisma.reservation.create({
        data: { id: reservation.id.toString(), ...rootData, version: reservation.version },
      });
      if (reservation.authorizedDriverIds.length > 0) {
        await prisma.reservationAuthorizedDriver.createMany({
          data: reservation.authorizedDriverIds.map((additionalDriverId) => ({
            id: EntityId.generate<'ReservationAuthorizedDriver'>().toString(),
            companyId: reservation.companyId,
            reservationId: reservation.id.toString(),
            additionalDriverId,
          })),
        });
      }
      reservation.markPersisted();
    } else {
      const result = await prisma.reservation.updateMany({
        where: { id: reservation.id.toString(), version: reservation.version - 1 },
        data: { ...rootData, version: reservation.version },
      });
      if (result.count === 0) {
        throw new ConcurrentModificationError('Reservation', reservation.id.toString());
      }
    }

    for (const inspection of reservation.pullDirtyInspections()) {
      await prisma.inspection.create({
        data: {
          id: inspection.id.toString(),
          companyId: reservation.companyId,
          reservationId: reservation.id.toString(),
          type: inspection.type,
          odometer: inspection.odometer.value,
          fuelLevel: inspection.fuelLevel.value,
          inspectedAt: inspection.inspectedAt,
          inspectedBy: inspection.inspectedBy,
        },
      });
      if (inspection.photoFileIds.length > 0) {
        await prisma.inspectionPhoto.createMany({
          data: inspection.photoFileIds.map((fileId) => ({
            id: EntityId.generate<'InspectionPhoto'>().toString(),
            companyId: reservation.companyId,
            inspectionId: inspection.id.toString(),
            fileId,
          })),
        });
      }
    }

    for (const damageReport of reservation.pullDirtyDamageReports()) {
      await prisma.damageReport.create({
        data: {
          id: damageReport.id.toString(),
          companyId: reservation.companyId,
          reservationId: reservation.id.toString(),
          inspectionId: damageReport.inspectionId,
          description: damageReport.description,
          severity: damageReport.severity,
          imputableToCustomer: damageReport.imputableToCustomer,
        },
      });
      if (damageReport.photoFileIds.length > 0) {
        await prisma.damageReportPhoto.createMany({
          data: damageReport.photoFileIds.map((fileId) => ({
            id: EntityId.generate<'DamageReportPhoto'>().toString(),
            companyId: reservation.companyId,
            damageReportId: damageReport.id.toString(),
            fileId,
          })),
        });
      }
    }

    for (const adjustment of reservation.pullDirtyPriceAdjustments()) {
      await prisma.priceAdjustment.create({
        data: {
          id: adjustment.id.toString(),
          companyId: reservation.companyId,
          reservationId: reservation.id.toString(),
          kind: adjustment.kind,
          amountMinorUnits: adjustment.amount.minorUnits,
          currency: adjustment.amount.currencyCode,
          reason: adjustment.reason,
        },
      });
    }
  }

  private toDomain(record: ReservationWithChildren): Reservation {
    const inspections = record.inspections.map((inspection) =>
      Inspection.reconstitute({
        id: EntityId.from<'Inspection'>(inspection.id),
        type: inspection.type,
        odometer: Odometer.from(inspection.odometer),
        fuelLevel: FuelLevel.from(inspection.fuelLevel),
        photoFileIds: inspection.photos.map((photo) => photo.fileId),
        inspectedAt: inspection.inspectedAt,
        inspectedBy: inspection.inspectedBy,
      }),
    );
    const damageReports = record.damageReports.map((damageReport) =>
      DamageReport.reconstitute({
        id: EntityId.from<'DamageReport'>(damageReport.id),
        inspectionId: damageReport.inspectionId,
        description: damageReport.description,
        severity: damageReport.severity,
        imputableToCustomer: damageReport.imputableToCustomer,
        photoFileIds: damageReport.photos.map((photo) => photo.fileId),
        createdAt: damageReport.createdAt,
      }),
    );
    const priceAdjustments = record.priceAdjustments.map((adjustment) =>
      PriceAdjustment.reconstitute({
        id: EntityId.from<'PriceAdjustment'>(adjustment.id),
        kind: adjustment.kind,
        amount: Money.from(adjustment.amountMinorUnits, adjustment.currency),
        reason: adjustment.reason ?? undefined,
        createdAt: adjustment.createdAt,
      }),
    );

    return Reservation.reconstitute(
      {
        id: EntityId.from<'Reservation'>(record.id),
        companyId: record.companyId,
        customerId: record.customerId,
        vehicleId: record.vehicleId,
        status: record.status,
        dateRange: DateRange.from(record.startDate, record.endDate),
        authorizedDriverIds: record.authorizedDrivers.map((driver) => driver.additionalDriverId),
        baseAmount: Money.from(record.baseAmountMinorUnits, record.baseAmountCurrency),
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
        deletedAt: record.deletedAt,
        version: record.version,
      },
      inspections,
      damageReports,
      priceAdjustments,
    );
  }
}
