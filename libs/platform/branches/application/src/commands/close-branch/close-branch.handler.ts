import { Inject, Injectable, Optional } from '@nestjs/common';

import {
  DOMAIN_EVENT_PUBLISHER,
  type DomainEventPublisher,
  EntityId,
  TRANSACTION_LOCK,
  type TransactionLock,
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
import { branchLockKey } from '../../locks/branch-lock-key';
import { BRANCH_REPOSITORY, type BranchRepository } from '../../ports/branch.repository';
import type { CloseBranchCommand } from './close-branch.command';

@Injectable()
export class CloseBranchHandler {
  constructor(
    @Inject(BRANCH_REPOSITORY) private readonly branchRepository: BranchRepository,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(DOMAIN_EVENT_PUBLISHER) private readonly eventPublisher: DomainEventPublisher,
    @Inject(TRANSACTION_LOCK) private readonly transactionLock: TransactionLock,
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

    await this.unitOfWork.run(async (tx) => {
      // #140: no cerrar con reservas que dependen de la sucursal. #141: con el lock exclusivo de
      // la sucursal (confirmar y cambiar de vehiculo toman el compartido), chequeo y cierre son
      // atomicos: una confirmacion en curso termina antes y se ve aca; una posterior espera y
      // despues ve la sucursal cerrada (409 BRANCH_CLOSED).
      await this.transactionLock.acquire(tx, branchLockKey(command.branchId), 'exclusive');
      const reservationIds =
        (await this.activeReservations?.findActiveReservationIds(
          command.companyId,
          command.branchId,
          tx,
        )) ?? [];
      if (reservationIds.length > 0) {
        throw new BranchHasActiveReservationsError(command.branchId, reservationIds);
      }
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
