import { Inject, Injectable } from '@nestjs/common';

import {
  DOMAIN_EVENT_PUBLISHER,
  type DomainEventPublisher,
  EntityId,
  UNIT_OF_WORK,
  type UnitOfWork,
} from '@platform/shared-kernel';
import { type BranchId, BranchNotFoundError } from '@platform/branches/domain';

import { BRANCH_REPOSITORY, type BranchRepository } from '../../ports/branch.repository';
import type { ReopenBranchCommand } from './reopen-branch.command';

@Injectable()
export class ReopenBranchHandler {
  constructor(
    @Inject(BRANCH_REPOSITORY) private readonly branchRepository: BranchRepository,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(DOMAIN_EVENT_PUBLISHER) private readonly eventPublisher: DomainEventPublisher,
  ) {}

  async execute(command: ReopenBranchCommand): Promise<void> {
    const branchId: BranchId = EntityId.from(command.branchId);
    const branch = await this.branchRepository.findById(branchId);
    if (!branch || branch.companyId !== command.companyId) {
      throw new BranchNotFoundError(command.branchId);
    }

    // #140 (patron de #56): si no cambio nada (ya estaba asi) es un no-op idempotente; guardar
    // sin subir la version daria un CONCURRENT_MODIFICATION espurio.
    const versionBefore = branch.version;
    branch.reopen();
    if (branch.version === versionBefore) {
      return;
    }

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
