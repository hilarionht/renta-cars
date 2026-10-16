import { Injectable } from '@nestjs/common';

import type { UnitOfWorkTransaction } from '@platform/shared-kernel';
import { asPrismaTransaction, ReadTransaction, RequestContext } from '@platform/persistence-kernel';
import {
  MoveSlotHandler,
  OccupySlotHandler,
  ReleaseSlotHandler,
  type ActiveBooking,
  type CalendarPort,
  type OccupySlotParams,
} from '@platform/calendar/application';

import { CheckAvailabilityHandler } from '../queries/check-availability.handler';

// Adapter delgado - CALENDAR_PORT (forward-looking, sin consumidor real todavia) traduce
// hacia los command/query handlers de application/, que llevan toda la logica real (mismo
// patron ya establecido: los ports son traductores, nunca reimplementan reglas de negocio).
@Injectable()
export class PrismaCalendarPortAdapter implements CalendarPort {
  constructor(
    private readonly occupySlot: OccupySlotHandler,
    private readonly releaseSlot: ReleaseSlotHandler,
    private readonly moveSlot: MoveSlotHandler,
    private readonly checkAvailability: CheckAvailabilityHandler,
    private readonly requestContext: RequestContext,
    private readonly readTransaction: ReadTransaction,
  ) {}

  async isAvailable(
    resourceType: string,
    resourceId: string,
    startDate: Date,
    endDate: Date,
    excludeReferenceId?: string,
  ): Promise<boolean> {
    const { companyId } = this.requestContext.get();
    const result = await this.checkAvailability.execute({
      companyId,
      resourceType,
      resourceId,
      startDate,
      endDate,
      excludeReferenceId,
    });
    return result.available;
  }

  async occupy(params: OccupySlotParams, tx?: UnitOfWorkTransaction): Promise<string> {
    const slotId = await this.occupySlot.execute(
      {
        companyId: params.companyId,
        resourceType: params.resourceType,
        resourceId: params.resourceId,
        startDate: params.startDate,
        endDate: params.endDate,
        slotKind: params.slotKind,
      },
      tx,
    );
    return slotId.toString();
  }

  async release(slotId: string, tx?: UnitOfWorkTransaction): Promise<void> {
    await this.releaseSlot.execute({ slotId }, tx);
  }

  async move(
    slotId: string,
    startDate: Date,
    endDate: Date,
    tx?: UnitOfWorkTransaction,
  ): Promise<string> {
    const newSlotId = await this.moveSlot.execute({ slotId, startDate, endDate }, tx);
    return newSlotId.toString();
  }

  async findActiveSlotId(
    resourceType: string,
    resourceId: string,
    referenceId: string,
    tx?: UnitOfWorkTransaction,
  ): Promise<string | null> {
    const query = {
      where: { resourceType, resourceId, referenceId, status: 'Active' as const },
      select: { id: true },
    };
    // #141: dentro de la transaccion del que llama si la hay (sin segunda conexion).
    const record = tx
      ? await asPrismaTransaction(tx).availabilitySlot.findFirst(query)
      : await this.readTransaction.run(
          (readTx) => readTx.availabilitySlot.findFirst(query),
          this.requestContext.get().companyId,
        );
    return record?.id ?? null;
  }

  // docs/persistence/10-DECISIONES.md #137.
  async findActiveBookings(
    companyId: string,
    resourceType: string,
    resourceId: string,
    tx?: UnitOfWorkTransaction,
  ): Promise<ActiveBooking[]> {
    const query = {
      where: {
        resourceType,
        resourceId,
        slotType: 'Booking' as const,
        status: 'Active' as const,
      },
      select: { referenceId: true, startDate: true, endDate: true },
      orderBy: { startDate: 'asc' as const },
    };
    // #141: los guards la llaman con el lock tomado, dentro de su transaccion.
    const records = tx
      ? await asPrismaTransaction(tx).availabilitySlot.findMany(query)
      : await this.readTransaction.run(
          (readTx) => readTx.availabilitySlot.findMany(query),
          companyId,
        );
    return records.map((record) => ({
      referenceId: record.referenceId ?? '',
      startDate: record.startDate,
      endDate: record.endDate,
    }));
  }

  // docs/persistence/10-DECISIONES.md #116: misma condicion de solapamiento que
  // CheckAvailabilityHandler, en batch (resourceId IN candidatos) en vez de uno por uno.
  async findOccupiedResourceIds(
    resourceType: string,
    resourceIds: string[],
    startDate: Date,
    endDate: Date,
  ): Promise<string[]> {
    if (resourceIds.length === 0) {
      return [];
    }
    const { companyId } = this.requestContext.get();
    const records = await this.readTransaction.run(
      (tx) =>
        tx.availabilitySlot.findMany({
          where: {
            resourceType,
            resourceId: { in: resourceIds },
            status: 'Active',
            startDate: { lt: endDate },
            endDate: { gt: startDate },
          },
          select: { resourceId: true },
          distinct: ['resourceId'],
        }),
      companyId,
    );
    return records.map((record) => record.resourceId);
  }
}
