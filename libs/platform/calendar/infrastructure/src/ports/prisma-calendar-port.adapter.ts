import { Injectable } from '@nestjs/common';

import { ReadTransaction, RequestContext } from '@platform/persistence-kernel';
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

  async occupy(params: OccupySlotParams): Promise<string> {
    const slotId = await this.occupySlot.execute({
      companyId: params.companyId,
      resourceType: params.resourceType,
      resourceId: params.resourceId,
      startDate: params.startDate,
      endDate: params.endDate,
      slotKind: params.slotKind,
    });
    return slotId.toString();
  }

  async release(slotId: string): Promise<void> {
    await this.releaseSlot.execute({ slotId });
  }

  async move(slotId: string, startDate: Date, endDate: Date): Promise<string> {
    const newSlotId = await this.moveSlot.execute({ slotId, startDate, endDate });
    return newSlotId.toString();
  }

  async findActiveSlotId(
    resourceType: string,
    resourceId: string,
    referenceId: string,
  ): Promise<string | null> {
    const { companyId } = this.requestContext.get();
    const record = await this.readTransaction.run(
      (tx) =>
        tx.availabilitySlot.findFirst({
          where: { resourceType, resourceId, referenceId, status: 'Active' },
          select: { id: true },
        }),
      companyId,
    );
    return record?.id ?? null;
  }

  // docs/persistence/10-DECISIONES.md #137.
  async findActiveBookings(
    companyId: string,
    resourceType: string,
    resourceId: string,
  ): Promise<ActiveBooking[]> {
    const records = await this.readTransaction.run(
      (tx) =>
        tx.availabilitySlot.findMany({
          where: { resourceType, resourceId, slotType: 'Booking', status: 'Active' },
          select: { referenceId: true, startDate: true, endDate: true },
          orderBy: { startDate: 'asc' },
        }),
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
