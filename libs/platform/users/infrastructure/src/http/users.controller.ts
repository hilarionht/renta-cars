import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';

import { RequestContext, RequirePermission, RequireStaffActor } from '@platform/persistence-kernel';
import {
  AssignRoleHandler,
  ChangePasswordHandler,
  CreateUserHandler,
  DisableUserHandler,
  ReactivateUserHandler,
  RevokeRoleHandler,
  UpdateUserDetailsHandler,
} from '@platform/users/application';

import { GetCurrentUserHandler } from '../queries/get-current-user.handler';
import { GetUserHandler } from '../queries/get-user.handler';
import { ListUsersHandler } from '../queries/list-users.handler';
import { AssignRoleRequestDto } from './dto/assign-role-request.dto';
import { ChangePasswordRequestDto } from './dto/change-password-request.dto';
import { CreateUserRequestDto } from './dto/create-user-request.dto';
import type { CurrentUserResponseDto } from './dto/current-user-response.dto';
import { DisableUserRequestDto } from './dto/disable-user-request.dto';
import { ListUsersRequestDto } from './dto/list-users-request.dto';
import { UpdateUserRequestDto } from './dto/update-user-request.dto';
import type { UserResponseDto } from './dto/user-response.dto';

// docs/contracts/02-RESOURCE-CATALOG.md SS1 "Identity & Access": users (create, disable/
// reactivate, change-password, assign/revoke role). companyId/userId "actor" siempre
// derivados de RequestContext.
@Controller('users')
export class UsersController {
  constructor(
    private readonly createUser: CreateUserHandler,
    private readonly disableUser: DisableUserHandler,
    private readonly reactivateUser: ReactivateUserHandler,
    private readonly changePassword: ChangePasswordHandler,
    private readonly assignRole: AssignRoleHandler,
    private readonly revokeRole: RevokeRoleHandler,
    private readonly updateUserDetails: UpdateUserDetailsHandler,
    private readonly getUser: GetUserHandler,
    private readonly getCurrentUser: GetCurrentUserHandler,
    private readonly listUsers: ListUsersHandler,
    private readonly requestContext: RequestContext,
  ) {}

  @Post()
  @RequirePermission('users:create')
  async create(@Body() dto: CreateUserRequestDto): Promise<{ id: string }> {
    const { companyId } = this.requestContext.get();
    const id = await this.createUser.execute({
      companyId,
      branchId: dto.branchId,
      email: dto.email,
      password: dto.password,
      name: dto.name,
      roles: dto.roles,
    });
    return { id: id.toString() };
  }

  // docs/persistence/10-DECISIONES.md #134: listado del personal. Sin @RequirePermission - leer
  // es libre para el personal autenticado (el catalogo no tiene users:read).
  @Get()
  async list(
    @Query() dto: ListUsersRequestDto,
  ): Promise<{ data: UserResponseDto[]; meta: { nextCursor: string | null; limit: number } }> {
    const { companyId } = this.requestContext.get();
    const result = await this.listUsers.execute({
      companyId,
      cursor: dto.cursor,
      limit: dto.limit,
    });
    return { data: result.items, meta: { nextCursor: result.nextCursor, limit: result.limit } };
  }

  // #134: perfil + permisos efectivos del usuario autenticado (menu de la web segun permisos).
  // Declarado ANTES de @Get(':id') - si no, ParseUUIDPipe rechaza "me" con 400. Solo personal:
  // un access token de Customer recibe 403 (mismo criterio que users/me/mfa).
  @Get('me')
  @RequireStaffActor()
  async me(): Promise<CurrentUserResponseDto> {
    const { companyId, userId, roles } = this.requestContext.get();
    return this.getCurrentUser.execute({ userId, companyId, roles });
  }

  @Get(':id')
  async get(@Param('id', ParseUUIDPipe) id: string): Promise<UserResponseDto> {
    const { companyId } = this.requestContext.get();
    return this.getUser.execute({ userId: id, companyId });
  }

  // #140: nombre y sucursal. El permiso users:edit existia pero no habia endpoint.
  @Patch(':id')
  @RequirePermission('users:edit')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserRequestDto,
  ): Promise<void> {
    const { companyId } = this.requestContext.get();
    await this.updateUserDetails.execute({
      userId: id,
      companyId,
      name: dto.name,
      branchId: dto.branchId,
    });
  }

  @Post(':id/disable')
  @RequirePermission('users:disable')
  async disable(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DisableUserRequestDto,
  ): Promise<void> {
    const { companyId, userId: actorId } = this.requestContext.get();
    await this.disableUser.execute({
      userId: id,
      companyId,
      disabledBy: actorId,
      reason: dto.reason,
    });
  }

  @Post(':id/reactivate')
  @RequirePermission('users:reactivate')
  async reactivate(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    const { companyId } = this.requestContext.get();
    await this.reactivateUser.execute({ userId: id, companyId });
  }

  @Post(':id/change-password')
  @RequirePermission('users:change-password')
  async changePasswordFor(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangePasswordRequestDto,
  ): Promise<void> {
    const { companyId, userId: actorId } = this.requestContext.get();
    await this.changePassword.execute({
      userId: id,
      companyId,
      newPassword: dto.newPassword,
      changedBy: actorId,
    });
  }

  @Post(':id/assign-role')
  @RequirePermission('users:assign-role')
  async assignRoleTo(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignRoleRequestDto,
  ): Promise<void> {
    const { companyId } = this.requestContext.get();
    await this.assignRole.execute({ userId: id, companyId, roleId: dto.roleId });
  }

  @Post(':id/revoke-role')
  @RequirePermission('users:revoke-role')
  async revokeRoleFrom(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignRoleRequestDto,
  ): Promise<void> {
    const { companyId } = this.requestContext.get();
    await this.revokeRole.execute({ userId: id, companyId, roleId: dto.roleId });
  }
}
