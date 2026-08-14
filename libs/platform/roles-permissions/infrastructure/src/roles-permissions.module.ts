import { Module } from '@nestjs/common';

import {
  CreateRoleHandler,
  DeactivateRoleHandler,
  EditRolePermissionsHandler,
  ROLE_LOOKUP_PORT,
  ROLE_REPOSITORY,
} from '@platform/roles-permissions/application';

import { PrismaRoleLookupAdapter } from './persistence/prisma/prisma-role-lookup.adapter';
import { PrismaRoleRepository } from './persistence/prisma/prisma-role.repository';
import { PermissionsController } from './http/permissions.controller';
import { RolesController } from './http/roles.controller';
import { ListPermissionsHandler } from './queries/list-permissions.handler';
import { ListRolesHandler } from './queries/list-roles.handler';

// Unico lugar donde se hace el binding puerto -> adaptador de este modulo
// (docs/05-CONVENCIONES-BACKEND.md SS3). RoleLookupPort se exporta - lo consume
// UsersModule para validar un roleId al asignarlo.
@Module({
  controllers: [RolesController, PermissionsController],
  providers: [
    { provide: ROLE_REPOSITORY, useClass: PrismaRoleRepository },
    { provide: ROLE_LOOKUP_PORT, useClass: PrismaRoleLookupAdapter },
    CreateRoleHandler,
    EditRolePermissionsHandler,
    DeactivateRoleHandler,
    ListRolesHandler,
    ListPermissionsHandler,
  ],
  exports: [ROLE_LOOKUP_PORT],
})
export class RolesPermissionsModule {}
