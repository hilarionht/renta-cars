import { Inject, Injectable } from '@nestjs/common';

import {
  DOMAIN_EVENT_PUBLISHER,
  type DomainEventPublisher,
  EntityId,
  UNIT_OF_WORK,
  type UnitOfWork,
} from '@platform/shared-kernel';
import { ReservationNotFoundError } from '@rental/reservations/domain';

import {
  RESERVATION_REPOSITORY,
  type ReservationRepository,
} from '../../ports/reservation.repository';
import type { CloseReservationCommand } from './close-reservation.command';

// close() reacciona conceptualmente a InvoiceIssued.v1 (INV-108/RN-22), pero ningun
// listener NestJS lo dispara todavia - Invoice/Commerce es Fase 2 (Hallazgo #10 del plan
// de implementacion). El handler existe e invocable por completitud del ciclo de vida,
// consistente con la maquina de estados completa ya implementada en domain/.
@Injectable()
export class CloseReservationHandler {
  constructor(
    @Inject(RESERVATION_REPOSITORY) private readonly reservationRepository: ReservationRepository,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(DOMAIN_EVENT_PUBLISHER) private readonly eventPublisher: DomainEventPublisher,
  ) {}

  async execute(command: CloseReservationCommand): Promise<void> {
    const reservation = await this.reservationRepository.findById(
      EntityId.from(command.reservationId),
    );
    if (!reservation || reservation.companyId !== command.companyId) {
      throw new ReservationNotFoundError(command.reservationId);
    }

    reservation.close({ hasInvoiceIssued: command.hasInvoiceIssued });

    await this.unitOfWork.run(async (tx) => {
      await this.reservationRepository.save(reservation, tx);
      for (const event of reservation.pullDomainEvents()) {
        await this.eventPublisher.publish(tx, {
          eventType: event.eventType,
          aggregateType: 'Reservation',
          aggregateId: reservation.id.toString(),
          companyId: reservation.companyId,
          payload: { ...event },
        });
      }
    });
  }
}
