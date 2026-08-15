import { Inject, Injectable } from '@nestjs/common';

import {
  DOMAIN_EVENT_PUBLISHER,
  type DomainEventPublisher,
  EntityId,
  UNIT_OF_WORK,
  type UnitOfWork,
} from '@platform/shared-kernel';
import {
  Address,
  type BranchId,
  BranchName,
  BranchNotFoundError,
  OperatingHours,
} from '@platform/branches/domain';

import { BRANCH_REPOSITORY, type BranchRepository } from '../../ports/branch.repository';
import type { UpdateBranchCommand } from './update-branch.command';

@Injectable()
export class UpdateBranchHandler {
  constructor(
    @Inject(BRANCH_REPOSITORY) private readonly branchRepository: BranchRepository,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(DOMAIN_EVENT_PUBLISHER) private readonly eventPublisher: DomainEventPublisher,
  ) {}

  async execute(command: UpdateBranchCommand): Promise<void> {
    const branchId: BranchId = EntityId.from(command.branchId);
    const branch = await this.branchRepository.findById(branchId);
    if (!branch || branch.companyId !== command.companyId) {
      throw new BranchNotFoundError(command.branchId);
    }

    branch.updateDetails({
      name: command.name ? BranchName.from(command.name) : undefined,
      address: command.address ? Address.from(command.address) : undefined,
      operatingHours: command.operatingHours
        ? OperatingHours.from(command.operatingHours)
        : undefined,
    });

    await this.unitOfWork.run(async (tx) => {
      await this.branchRepository.save(branch, tx);
      for (const event of branch.pullDomainEvents()) {
        await this.eventPublisher.publish(tx, {
          eventType: event.eventType,
          aggregateType: 'Branch',
          aggregateId: branch.id.toString(),
          companyId: branch.companyId,
          payload: { ...event },
        });
      }
    });
  }
}
