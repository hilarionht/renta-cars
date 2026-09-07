import { Module } from '@nestjs/common';

import { RedisCacheModule } from '@platform/persistence-kernel';
import {
  CreateRoleHandler,
  DeactivateRoleHandler,
  EditRolePermissionsHandler,
  ROLE_LOOKUP_PORT,
  ROLE_REPOSITORY,
} from '@platform/roles-permissions/application';

import { CachedRoleLookupAdapter } from './persistence/cached-role-lookup.adapter';
import { PrismaRoleLookupAdapter } from './persistence/prisma/prisma-role-lookup.adapter';
import { PrismaRoleRepository } from './persistence/prisma/prisma-role.repository';
import { PermissionsController } from './http/permissions.controller';
import { RolesController } from './http/roles.controller';
import { ListPermissionsHandler } from './queries/list-permissions.handler';
import { ListRolesHandler } from './queries/list-roles.handler';

// Unico lugar donde se hace el binding puerto -> adaptador de este modulo
// (docs/05-CONVENCIONES-BACKEND.md SS3). RoleLookupPort se exporta - lo consume UsersModule
// (validar un roleId al asignarlo) y PermissionGuard (apps/api, RBAC completo Fase 4 item 2)
// para resolver roles[] -> permissions[]. ROLE_LOOKUP_PORT se bindea a
// CachedRoleLookupAdapter (cache en Redis compartido entre instancias, RedisCacheModule -
// Fase 6/Hardening "cache/performance", docs/persistence/10-DECISIONES.md #106; invalidado
// por RolePermissionsChanged.v1/RoleDeactivated.v1) - PrismaRoleLookupAdapter queda como
// provider propio, inyectado directo dentro del adapter cacheado, nunca expuesto el mismo
// como ROLE_LOOKUP_PORT.
@Module({
  imports: [RedisCacheModule],
  controllers: [RolesController, PermissionsController],
  providers: [
    { provide: ROLE_REPOSITORY, useClass: PrismaRoleRepository },
    PrismaRoleLookupAdapter,
    { provide: ROLE_LOOKUP_PORT, useClass: CachedRoleLookupAdapter },
    CreateRoleHandler,
    EditRolePermissionsHandler,
    DeactivateRoleHandler,
    ListRolesHandler,
    ListPermissionsHandler,
  ],
  exports: [ROLE_LOOKUP_PORT],
})
export class RolesPermissionsModule {}
