import { Injectable } from '@nestjs/common';

import { ReadTransaction, RequestContext } from '@platform/persistence-kernel';
import {
  OccupySlotHandler,
  ReleaseSlotHandler,
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
    private readonly checkAvailability: CheckAvailabilityHandler,
    private readonly requestContext: RequestContext,
    private readonly readTransaction: ReadTransaction,
  ) {}

  async isAvailable(
    resourceType: string,
    resourceId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<boolean> {
    const { companyId } = this.requestContext.get();
    const result = await this.checkAvailability.execute({
      companyId,
      resourceType,
      resourceId,
      startDate,
      endDate,
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

  async findActiveSlotId(resourceType: string, resourceId: string): Promise<string | null> {
    const { companyId } = this.requestContext.get();
    const record = await this.readTransaction.run(
      (tx) =>
        tx.availabilitySlot.findFirst({
          where: { resourceType, resourceId, status: 'Active' },
          select: { id: true },
        }),
      companyId,
    );
    return record?.id ?? null;
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
