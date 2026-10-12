import { Injectable } from '@nestjs/common';

import { ReadTransaction } from '@platform/persistence-kernel';
import type {
  CheckAvailabilityQuery,
  CheckAvailabilityResult,
} from '@platform/calendar/application';

@Injectable()
export class CheckAvailabilityHandler {
  constructor(private readonly readTransaction: ReadTransaction) {}

  async execute(query: CheckAvailabilityQuery): Promise<CheckAvailabilityResult> {
    const overlapping = await this.readTransaction.run(
      (tx) =>
        tx.availabilitySlot.findFirst({
          where: {
            resourceType: query.resourceType,
            resourceId: query.resourceId,
            status: 'Active',
            startDate: { lt: query.endDate },
            endDate: { gt: query.startDate },
          },
          select: { id: true },
        }),
      query.companyId,
    );

    return { available: overlapping === null };
  }
}
