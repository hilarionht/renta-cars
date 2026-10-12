import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { AvailabilitySlot as PrismaAvailabilitySlot } from '@prisma/client';

import { asPrismaTransaction, ReadTransaction } from '@platform/persistence-kernel';
import {
  ConcurrentModificationError,
  DateRange,
  EntityId,
  type UnitOfWorkTransaction,
} from '@platform/shared-kernel';
import {
  AvailabilitySlot,
  type AvailabilitySlotId,
  AvailabilitySlotOverlapError,
  ResourceRef,
  type SlotKindValue,
} from '@platform/calendar/domain';
import type { AvailabilitySlotRepository } from '@platform/calendar/application';

// Nombre de la exclusion constraint GiST parcial (docs/persistence/07-MIGRACIONES.md SS3,
// migracion 20260819010540_scheduling_availability_slots) - mismo criterio que
// PrismaVehicleCategoryRepository (Vehicles): sin codigo P dedicado de Prisma para EXCLUDE,
// se distingue por el nombre de constraint en el mensaje crudo del driver.
const OVERLAP_CONSTRAINT = 'availability_slots_no_overlapping_active';

@Injectable()
export class PrismaAvailabilitySlotRepository implements AvailabilitySlotRepository {
  constructor(private readonly readTransaction: ReadTransaction) {}

  async findById(id: AvailabilitySlotId): Promise<AvailabilitySlot | null> {
    const record = await this.readTransaction.run((tx) =>
      tx.availabilitySlot.findFirst({ where: { id: id.toString() } }),
    );
    return record ? this.toDomain(record) : null;
  }

  async save(slot: AvailabilitySlot, tx: UnitOfWorkTransaction): Promise<void> {
    const prisma = asPrismaTransaction(tx);
    const rootData = {
      companyId: slot.companyId,
      resourceType: slot.resourceRef.type,
      resourceId: slot.resourceRef.id,
      startDate: slot.dateRange.start,
      endDate: slot.dateRange.end,
      slotType: slot.slotKind.type,
      referenceId: slot.slotKind.type === 'Booking' ? slot.slotKind.referenceId : null,
      reason: slot.slotKind.type === 'Blackout' ? (slot.slotKind.reason ?? null) : null,
      status: slot.status,
    };

    if (slot.isNew) {
      try {
        await prisma.availabilitySlot.create({
          data: { id: slot.id.toString(), ...rootData, version: slot.version },
        });
      } catch (error) {
        if (this.isOverlapViolation(error)) {
          throw new AvailabilitySlotOverlapError(slot.resourceRef.type, slot.resourceRef.id);
        }
        throw error;
      }
      slot.markPersisted();
    } else {
      const result = await prisma.availabilitySlot.updateMany({
        where: { id: slot.id.toString(), version: slot.version - 1 },
        data: { status: rootData.status, version: slot.version },
      });
      if (result.count === 0) {
        throw new ConcurrentModificationError('AvailabilitySlot', slot.id.toString());
      }
    }
  }

  private isOverlapViolation(error: unknown): boolean {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError ||
      error instanceof Prisma.PrismaClientUnknownRequestError
    ) {
      return error.message.includes(OVERLAP_CONSTRAINT);
    }
    return false;
  }

  private toDomain(record: PrismaAvailabilitySlot): AvailabilitySlot {
    const slotKind: SlotKindValue =
      record.slotType === 'Booking'
        ? { type: 'Booking', referenceId: record.referenceId as string }
        : { type: 'Blackout', reason: record.reason ?? undefined };

    return AvailabilitySlot.reconstitute({
      id: EntityId.from<'AvailabilitySlot'>(record.id),
      companyId: record.companyId,
      resourceRef: ResourceRef.from(record.resourceType, record.resourceId),
      dateRange: DateRange.from(record.startDate, record.endDate),
      slotKind,
      status: record.status,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      version: record.version,
    });
  }
}
