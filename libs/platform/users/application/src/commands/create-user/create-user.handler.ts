import { Inject, Injectable } from '@nestjs/common';

import {
  COMPANY_EXISTS_PORT,
  type CompanyExistsPort,
  DOMAIN_EVENT_PUBLISHER,
  type DomainEventPublisher,
  Email,
  UNIT_OF_WORK,
  type UnitOfWork,
} from '@platform/shared-kernel';
import {
  CompanyNotFoundError,
  DuplicateEmailError,
  InvalidRoleAssignmentError,
  PasswordHash,
  PersonName,
  User,
  type UserId,
} from '@platform/users/domain';
import { ROLE_LOOKUP_PORT, type RoleLookupPort } from '@platform/roles-permissions/application';
import { BRANCH_LOOKUP_PORT, type BranchLookupPort } from '@platform/branches/application';

import { PASSWORD_HASHER, type PasswordHasher } from '../../ports/password-hasher.port';
import { USER_REPOSITORY, type UserRepository } from '../../ports/user.repository';
import { assertBranchAssignable } from '../../services/assert-branch-assignable';
import type { CreateUserCommand } from './create-user.command';

@Injectable()
export class CreateUserHandler {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepository: UserRepository,
    @Inject(PASSWORD_HASHER) private readonly passwordHasher: PasswordHasher,
    @Inject(ROLE_LOOKUP_PORT) private readonly roleLookup: RoleLookupPort,
    @Inject(COMPANY_EXISTS_PORT) private readonly companyExists: CompanyExistsPort,
    @Inject(BRANCH_LOOKUP_PORT) private readonly branchLookup: BranchLookupPort,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(DOMAIN_EVENT_PUBLISHER) private readonly eventPublisher: DomainEventPublisher,
  ) {}

  async execute(command: CreateUserCommand): Promise<UserId> {
    const email = Email.from(command.email);
    const name = PersonName.from(command.name);

    if (!(await this.companyExists.exists(command.companyId))) {
      throw new CompanyNotFoundError(command.companyId);
    }

    const existing = await this.userRepository.findByCompanyAndEmail(
      command.companyId,
      email.toString(),
    );
    if (existing) {
      throw new DuplicateEmailError(email.toString());
    }

    // #140: la sucursal tiene que existir y estar abierta.
    if (command.branchId) {
      await assertBranchAssignable(this.branchLookup, command.branchId);
    }

    for (const roleId of command.roles) {
      const valid = await this.roleLookup.existsAndBelongsToCompanyOrSystem(
        roleId,
        command.companyId,
      );
      if (!valid) {
        throw new InvalidRoleAssignmentError(roleId);
      }
    }

    const passwordHash = PasswordHash.fromHash(await this.passwordHasher.hash(command.password));
    const user = User.create({
      companyId: command.companyId,
      branchId: command.branchId,
      email,
      passwordHash,
      name,
      roles: command.roles,
    });

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

    return user.id;
  }
}
