import { Module } from '@nestjs/common';

import {
  BRANCH_LOOKUP_PORT,
  BRANCH_REPOSITORY,
  CloseBranchHandler,
  CreateBranchHandler,
  ReopenBranchHandler,
  UpdateBranchHandler,
} from '@platform/branches/application';

import { PrismaBranchLookupAdapter } from './persistence/prisma/prisma-branch-lookup.adapter';
import { PrismaBranchRepository } from './persistence/prisma/prisma-branch.repository';
import { BranchesController } from './http/branches.controller';
import { GetBranchHandler } from './queries/get-branch.handler';
import { ListBranchesHandler } from './queries/list-branches.handler';

@Module({
  controllers: [BranchesController],
  providers: [
    { provide: BRANCH_REPOSITORY, useClass: PrismaBranchRepository },
    { provide: BRANCH_LOOKUP_PORT, useClass: PrismaBranchLookupAdapter },
    CreateBranchHandler,
    UpdateBranchHandler,
    CloseBranchHandler,
    ReopenBranchHandler,
    GetBranchHandler,
    ListBranchesHandler,
  ],
  // BRANCH_LOOKUP_PORT se exporta - futuro consumidor cross-modulo (Rental Operations,
  // INV-112), sin consumidor real todavia.
  exports: [BRANCH_LOOKUP_PORT],
})
export class BranchesModule {}
