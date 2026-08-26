import { Injectable } from '@nestjs/common';

import { ReadTransaction } from '@platform/persistence-kernel';
import { UserNotFoundError } from '@platform/users/domain';

export interface GetMfaStatusQuery {
  userId: string;
  companyId: string;
}

// Mismo patron que GetUserHandler: query de solo lectura via ReadTransaction, proyeccion
// minima (CQRS selectivo, ADR-0007) - no hace falta pasar por USER_REPOSITORY completo para
// un unico booleano.
@Injectable()
export class GetMfaStatusHandler {
  constructor(private readonly readTransaction: ReadTransaction) {}

  async execute(query: GetMfaStatusQuery): Promise<{ enabled: boolean }> {
    return this.readTransaction.run(async (tx) => {
      const record = await tx.user.findFirst({
        where: { id: query.userId, companyId: query.companyId },
        select: { mfaEnabled: true },
      });

      if (!record) {
        throw new UserNotFoundError(query.userId);
      }

      return { enabled: record.mfaEnabled };
    });
  }
}
