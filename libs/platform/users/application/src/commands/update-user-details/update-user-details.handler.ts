import { Inject, Injectable } from '@nestjs/common';

import {
  DOMAIN_EVENT_PUBLISHER,
  type DomainEventPublisher,
  EntityId,
  UNIT_OF_WORK,
  type UnitOfWork,
} from '@platform/shared-kernel';
import { PersonName, type UserId, UserNotFoundError } from '@platform/users/domain';
import { BRANCH_LOOKUP_PORT, type BranchLookupPort } from '@platform/branches/application';

import { USER_REPOSITORY, type UserRepository } from '../../ports/user.repository';
import { assertBranchAssignable } from '../../services/assert-branch-assignable';
import type { UpdateUserDetailsCommand } from './update-user-details.command';

// docs/persistence/10-DECISIONES.md #140 (decision del usuario): PATCH /users/:id con nombre y
// sucursal. El cambio de sucursal llega al token en el proximo refresh (mismo gap que roles).
@Injectable()
export class UpdateUserDetailsHandler {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepository: UserRepository,
    @Inject(BRANCH_LOOKUP_PORT) private readonly branchLookup: BranchLookupPort,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(DOMAIN_EVENT_PUBLISHER) private readonly eventPublisher: DomainEventPublisher,
  ) {}

  async execute(command: UpdateUserDetailsCommand): Promise<void> {
    const name = command.name !== undefined ? PersonName.from(command.name) : undefined;

    const userId: UserId = EntityId.from(command.userId);
    const user = await this.userRepository.findById(userId);
    if (!user || user.companyId !== command.companyId) {
      throw new UserNotFoundError(command.userId);
    }

    if (command.branchId && command.branchId !== user.branchId) {
      await assertBranchAssignable(this.branchLookup, command.branchId);
    }

    const versionBefore = user.version;
    user.updateDetails({ name, branchId: command.branchId });
    if (user.version === versionBefore) {
      return;
    }

    await this.unitOfWork.run(async (tx) => {
      await this.userRepository.save(user, tx);
      for (const event of user.pullDomainEvents()) {
        await this.eventPublisher.publish(tx, {
          eventType: event.eventType,
          aggregateType: 'User',
          aggregateId: user.id.toString(),
          companyId: user.companyId,
          payload: { ...event },
        });
      }
    });
  }
}
