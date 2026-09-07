import { Inject, Injectable } from '@nestjs/common';

import {
  DOMAIN_EVENT_PUBLISHER,
  type DomainEventPublisher,
  UNIT_OF_WORK,
  type UnitOfWork,
} from '@platform/shared-kernel';
import {
  Address,
  Branch,
  type BranchId,
  BranchName,
  OperatingHours,
} from '@platform/branches/domain';

import { BRANCH_REPOSITORY, type BranchRepository } from '../../ports/branch.repository';
import type { CreateBranchCommand } from './create-branch.command';

// Sin CompanyExistsPort: companyId siempre viene del JWT ya validado (TenantContextGuard),
// la company existe por construccion - a diferencia de CreateUser (construido cuando
// Companies no existia todavia). Ver docs/persistence/10-DECISIONES.md.
@Injectable()
export class CreateBranchHandler {
  constructor(
    @Inject(BRANCH_REPOSITORY) private readonly branchRepository: BranchRepository,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(DOMAIN_EVENT_PUBLISHER) private readonly eventPublisher: DomainEventPublisher,
  ) {}

  async execute(command: CreateBranchCommand): Promise<BranchId> {
    const branch = Branch.create({
      companyId: command.companyId,
      name: BranchName.from(command.name),
      address: Address.from(command.address),
      operatingHours: OperatingHours.from(command.operatingHours),
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

    return branch.id;
  }
}
