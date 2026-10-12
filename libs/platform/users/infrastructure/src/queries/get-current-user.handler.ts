import { Inject, Injectable } from '@nestjs/common';

import { ReadTransaction } from '@platform/persistence-kernel';
import { ROLE_LOOKUP_PORT, type RoleLookupPort } from '@platform/roles-permissions/application';
import type { CurrentUserProfile, GetCurrentUserQuery } from '@platform/users/application';
import { UserNotFoundError } from '@platform/users/domain';

// docs/persistence/10-DECISIONES.md #134: GET /users/me. Perfil desde la base (mismo shape que
// GetUserHandler) + permisos efectivos resueltos con el mismo ROLE_LOOKUP_PORT (cacheado) que
// usa PermissionGuard, a partir de los roles del access token.
@Injectable()
export class GetCurrentUserHandler {
  constructor(
    private readonly readTransaction: ReadTransaction,
    @Inject(ROLE_LOOKUP_PORT) private readonly roleLookupPort: RoleLookupPort,
  ) {}

  async execute(query: GetCurrentUserQuery): Promise<CurrentUserProfile> {
    const record = await this.readTransaction.run(
      (tx) =>
        tx.user.findFirst({
          where: { id: query.userId, companyId: query.companyId },
          include: { roles: true },
        }),
      query.companyId,
    );
    if (!record) {
      throw new UserNotFoundError(query.userId);
    }

    const permissions = await this.roleLookupPort.getPermissionsForRoles(
      [...query.roles],
      query.companyId,
    );

    return {
      id: record.id,
      email: record.email,
      name: record.name,
      status: record.status,
      roles: record.roles.map((r) => r.roleId),
      branchId: record.branchId ?? undefined,
      companyId: query.companyId,
      permissions: [...new Set(permissions)].sort(),
    };
  }
}
