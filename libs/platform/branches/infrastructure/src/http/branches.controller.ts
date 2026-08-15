import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';

import { RequestContext } from '@platform/persistence-kernel';
import {
  CloseBranchHandler,
  CreateBranchHandler,
  ReopenBranchHandler,
  UpdateBranchHandler,
} from '@platform/branches/application';

import { GetBranchHandler } from '../queries/get-branch.handler';
import { ListBranchesHandler } from '../queries/list-branches.handler';
import type { BranchResponseDto } from './dto/branch-response.dto';
import { CreateBranchRequestDto } from './dto/create-branch-request.dto';
import { UpdateBranchRequestDto } from './dto/update-branch-request.dto';

// docs/contracts/02-RESOURCE-CATALOG.md SS2: "branches" siempre escopeado por la company del
// token - companyId nunca viaja en el body/query como fuente de verdad.
@Controller('branches')
export class BranchesController {
  constructor(
    private readonly createBranch: CreateBranchHandler,
    private readonly updateBranch: UpdateBranchHandler,
    private readonly closeBranch: CloseBranchHandler,
    private readonly reopenBranch: ReopenBranchHandler,
    private readonly getBranch: GetBranchHandler,
    private readonly listBranches: ListBranchesHandler,
    private readonly requestContext: RequestContext,
  ) {}

  @Post()
  async create(@Body() dto: CreateBranchRequestDto): Promise<{ id: string }> {
    const { companyId } = this.requestContext.get();
    const id = await this.createBranch.execute({
      companyId,
      name: dto.name,
      address: dto.address,
      operatingHours: dto.operatingHours,
    });
    return { id: id.toString() };
  }

  @Get()
  async list(): Promise<BranchResponseDto[]> {
    const { companyId } = this.requestContext.get();
    return this.listBranches.execute({ companyId });
  }

  @Get(':id')
  async get(@Param('id', ParseUUIDPipe) id: string): Promise<BranchResponseDto> {
    const { companyId } = this.requestContext.get();
    return this.getBranch.execute({ branchId: id, companyId });
  }

  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateBranchRequestDto,
  ): Promise<void> {
    const { companyId } = this.requestContext.get();
    await this.updateBranch.execute({
      branchId: id,
      companyId,
      name: dto.name,
      address: dto.address,
      operatingHours: dto.operatingHours,
    });
  }

  @Post(':id/close')
  async close(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    const { companyId } = this.requestContext.get();
    await this.closeBranch.execute({ branchId: id, companyId });
  }

  @Post(':id/reopen')
  async reopen(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    const { companyId } = this.requestContext.get();
    await this.reopenBranch.execute({ branchId: id, companyId });
  }
}
