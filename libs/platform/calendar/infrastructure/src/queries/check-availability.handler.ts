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
            // #136: con OR + null, no con `not` a secas: `reference_id <> x` descarta los NULL
            // (Blackout/Maintenance no tienen referencia) y dejaria de verlos como ocupacion.
            ...(query.excludeReferenceId
              ? {
                  OR: [{ referenceId: null }, { referenceId: { not: query.excludeReferenceId } }],
                }
              : {}),
          },
          select: { id: true },
        }),
      query.companyId,
    );

    return { available: overlapping === null };
  }
}
