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
}
