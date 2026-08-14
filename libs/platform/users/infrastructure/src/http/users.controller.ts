import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';

import { RequestContext } from '@platform/persistence-kernel';
import {
  AssignRoleHandler,
  ChangePasswordHandler,
  CreateUserHandler,
  DisableUserHandler,
  ReactivateUserHandler,
  RevokeRoleHandler,
} from '@platform/users/application';

import { GetUserHandler } from '../queries/get-user.handler';
import { AssignRoleRequestDto } from './dto/assign-role-request.dto';
import { ChangePasswordRequestDto } from './dto/change-password-request.dto';
import { CreateUserRequestDto } from './dto/create-user-request.dto';
import { DisableUserRequestDto } from './dto/disable-user-request.dto';
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
    private readonly getUser: GetUserHandler,
    private readonly requestContext: RequestContext,
  ) {}

  @Post()
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

  @Get(':id')
  async get(@Param('id', ParseUUIDPipe) id: string): Promise<UserResponseDto> {
    const { companyId } = this.requestContext.get();
    return this.getUser.execute({ userId: id, companyId });
  }

  @Post(':id/disable')
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
  async reactivate(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    const { companyId } = this.requestContext.get();
    await this.reactivateUser.execute({ userId: id, companyId });
  }

  @Post(':id/change-password')
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
  async assignRoleTo(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignRoleRequestDto,
  ): Promise<void> {
    const { companyId } = this.requestContext.get();
    await this.assignRole.execute({ userId: id, companyId, roleId: dto.roleId });
  }

  @Post(':id/revoke-role')
  async revokeRoleFrom(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignRoleRequestDto,
  ): Promise<void> {
    const { companyId } = this.requestContext.get();
    await this.revokeRole.execute({ userId: id, companyId, roleId: dto.roleId });
  }
}
