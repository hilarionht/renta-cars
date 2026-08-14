import { Injectable } from '@nestjs/common';

import { ReadTransaction } from '@platform/persistence-kernel';
import type { GetUserQuery, UserSummary } from '@platform/users/application';
import { UserNotFoundError } from '@platform/users/domain';

@Injectable()
export class GetUserHandler {
  constructor(private readonly readTransaction: ReadTransaction) {}

  async execute(query: GetUserQuery): Promise<UserSummary> {
    return this.readTransaction.run(async (tx) => {
      const record = await tx.user.findFirst({
        where: { id: query.userId, companyId: query.companyId },
        include: { roles: true },
      });

      if (!record) {
        throw new UserNotFoundError(query.userId);
      }

      return {
        id: record.id,
        email: record.email,
        name: record.name,
        status: record.status,
        roles: record.roles.map((r) => r.roleId),
        branchId: record.branchId ?? undefined,
      };
    });
  }
}
