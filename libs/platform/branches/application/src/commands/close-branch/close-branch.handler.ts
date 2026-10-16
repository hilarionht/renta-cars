import { Inject, Injectable, Optional } from '@nestjs/common';

import {
  DOMAIN_EVENT_PUBLISHER,
  type DomainEventPublisher,
  EntityId,
  UNIT_OF_WORK,
  type UnitOfWork,
} from '@platform/shared-kernel';
import {
  type BranchId,
  BranchHasActiveReservationsError,
  BranchNotFoundError,
} from '@platform/branches/domain';

import {
  BRANCH_ACTIVE_RESERVATIONS_PORT,
  type BranchActiveReservationsPort,
} from '../../ports/branch-active-reservations.port';
import { BRANCH_REPOSITORY, type BranchRepository } from '../../ports/branch.repository';
import type { CloseBranchCommand } from './close-branch.command';

@Injectable()
export class CloseBranchHandler {
  constructor(
    @Inject(BRANCH_REPOSITORY) private readonly branchRepository: BranchRepository,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(DOMAIN_EVENT_PUBLISHER) private readonly eventPublisher: DomainEventPublisher,
    @Optional()
    @Inject(BRANCH_ACTIVE_RESERVATIONS_PORT)
    private readonly activeReservations?: BranchActiveReservationsPort,
  ) {}

  async execute(command: CloseBranchCommand): Promise<void> {
    const branchId: BranchId = EntityId.from(command.branchId);
    const branch = await this.branchRepository.findById(branchId);
    if (!branch || branch.companyId !== command.companyId) {
      throw new BranchNotFoundError(command.branchId);
    }

    // #140 (patron de #56): si no cambio nada (ya estaba asi) es un no-op idempotente; guardar
    // sin subir la version daria un CONCURRENT_MODIFICATION espurio.
    const versionBefore = branch.version;
    branch.close();
    if (branch.version === versionBefore) {
      return;
    }

    // #140: no cerrar con reservas que dependen de la sucursal. Chequeo y cierre no son atomicos
    // (gap aceptado, igual que #137).
    const reservationIds =
      (await this.activeReservations?.findActiveReservationIds(
        command.companyId,
        command.branchId,
      )) ?? [];
    if (reservationIds.length > 0) {
      throw new BranchHasActiveReservationsError(command.branchId, reservationIds);
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
