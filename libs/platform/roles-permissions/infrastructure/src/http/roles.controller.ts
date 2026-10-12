import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';

import { RequestContext, RequirePermission } from '@platform/persistence-kernel';
import {
  CreateRoleHandler,
  DeactivateRoleHandler,
  EditRolePermissionsHandler,
} from '@platform/roles-permissions/application';

import { ListRolesHandler } from '../queries/list-roles.handler';
import { CreateRoleRequestDto } from './dto/create-role-request.dto';
import { EditRolePermissionsRequestDto } from './dto/edit-role-permissions-request.dto';
import type { RoleResponseDto } from './dto/role-response.dto';

// docs/contracts/02-RESOURCE-CATALOG.md SS1 "Identity & Access": roles (create Custom, edit
// permission set - System es de solo lectura, ver EmptyPermissionSetError/
// SystemRoleImmutableError). companyId siempre derivado de RequestContext, nunca del body
// (docs/05-CONVENCIONES-BACKEND.md SS7).
@Controller('roles')
export class RolesController {
  constructor(
    private readonly createRole: CreateRoleHandler,
    private readonly editRolePermissions: EditRolePermissionsHandler,
    private readonly deactivateRole: DeactivateRoleHandler,
    private readonly listRoles: ListRolesHandler,
    private readonly requestContext: RequestContext,
  ) {}

  @Post()
  @RequirePermission('roles:create')
  async create(@Body() dto: CreateRoleRequestDto): Promise<{ id: string }> {
    const { companyId } = this.requestContext.get();
    const id = await this.createRole.execute({
      companyId,
      roleName: dto.roleName,
      permissions: dto.permissions,
    });
    return { id: id.toString() };
  }

  @Patch(':id/permissions')
  @RequirePermission('roles:edit-permissions')
  async editPermissions(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: EditRolePermissionsRequestDto,
  ): Promise<void> {
    const { companyId } = this.requestContext.get();
    await this.editRolePermissions.execute({ roleId: id, companyId, permissions: dto.permissions });
  }

  @Post(':id/deactivate')
  @RequirePermission('roles:deactivate')
  async deactivate(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    const { companyId } = this.requestContext.get();
    await this.deactivateRole.execute({ roleId: id, companyId });
  }

  @Get()
  async list(): Promise<RoleResponseDto[]> {
    const { companyId } = this.requestContext.get();
    return this.listRoles.execute({ companyId });
  }
}
