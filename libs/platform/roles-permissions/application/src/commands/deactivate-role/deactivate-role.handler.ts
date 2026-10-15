import { Inject, Injectable } from '@nestjs/common';

import {
  DOMAIN_EVENT_PUBLISHER,
  type DomainEventPublisher,
  EntityId,
  UNIT_OF_WORK,
  type UnitOfWork,
} from '@platform/shared-kernel';
import {
  type RoleId,
  RoleNotFoundError,
  SystemRoleImmutableError,
} from '@platform/roles-permissions/domain';

import { ROLE_REPOSITORY, type RoleRepository } from '../../ports/role.repository';
import type { DeactivateRoleCommand } from './deactivate-role.command';

@Injectable()
export class DeactivateRoleHandler {
  constructor(
    @Inject(ROLE_REPOSITORY) private readonly roleRepository: RoleRepository,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(DOMAIN_EVENT_PUBLISHER) private readonly eventPublisher: DomainEventPublisher,
  ) {}

  async execute(command: DeactivateRoleCommand): Promise<void> {
    // #140: primero la lectura liviana por el id crudo - un role System (inmutable) responde 403
    // sin cargar el agregado (los System de los seeds viejos tienen id v4 y daban 500).
    const summary = await this.roleRepository.findSummaryById(command.roleId);
    // Un Custom role de otra company no existe desde la perspectiva de esta request - mismo
    // codigo (RESOURCE_NOT_FOUND) que un id inexistente, nunca revela que el recurso existe
    // en otro tenant (docs/09-SEGURIDAD.md SS5).
    if (!summary || (summary.scope === 'Custom' && summary.companyId !== command.companyId)) {
      throw new RoleNotFoundError(command.roleId);
    }
    if (summary.scope === 'System') {
      throw new SystemRoleImmutableError(command.roleId);
    }

    const roleId: RoleId = EntityId.from(command.roleId);
    const role = await this.roleRepository.findById(roleId);
    if (!role) {
      throw new RoleNotFoundError(command.roleId);
    }

    // #140 (patron de #56): si no cambio nada (ya estaba asi) es un no-op idempotente; guardar
    // sin subir la version daria un CONCURRENT_MODIFICATION espurio.
    const versionBefore = role.version;
    role.deactivate();
    if (role.version === versionBefore) {
      return;
    }

    await this.unitOfWork.run(async (tx) => {
      await this.roleRepository.save(role, tx);
      for (const event of role.pullDomainEvents()) {
        await this.eventPublisher.publish(tx, {
          eventType: event.eventType,
          aggregateType: 'Role',
          aggregateId: role.id.toString(),
          companyId: role.companyId,
          payload: { ...event },
        });
      }
    });
  }
}
