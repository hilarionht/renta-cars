import { Inject, Injectable } from '@nestjs/common';

import {
  DateRange,
  DOMAIN_EVENT_PUBLISHER,
  type DomainEventPublisher,
  EntityId,
  UNIT_OF_WORK,
  type UnitOfWork,
  type UnitOfWorkTransaction,
} from '@platform/shared-kernel';
import {
  AvailabilitySlot,
  type AvailabilitySlotId,
  AvailabilitySlotNotFoundError,
} from '@platform/calendar/domain';

import {
  AVAILABILITY_SLOT_REPOSITORY,
  type AvailabilitySlotRepository,
} from '../../ports/availability-slot.repository';
import type { MoveSlotCommand } from './move-slot.command';

// docs/persistence/10-DECISIONES.md #136: cambiar las fechas de una ocupacion (reprogramar o
// extender una reserva). El slot nunca se edita en el rango (docs/model/02-AGGREGATES.md SS7):
// se libera el viejo y se ocupa uno nuevo, pero en UNA sola transaccion y en ese orden. La
// exclusion GiST es parcial (WHERE status = 'Active'), asi que el viejo ya liberado no choca
// con el nuevo aunque se superpongan; si el nuevo choca con OTRO slot, la transaccion entera
// vuelve atras y el viejo sigue Active (sin ventana con el recurso libre).
// Antes (#59) AvailabilityService ocupaba el nuevo antes de liberar el viejo, en dos
// transacciones: cualquier rango superpuesto al actual chocaba consigo mismo.
@Injectable()
export class MoveSlotHandler {
  constructor(
    @Inject(AVAILABILITY_SLOT_REPOSITORY)
    private readonly availabilitySlotRepository: AvailabilitySlotRepository,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(DOMAIN_EVENT_PUBLISHER) private readonly eventPublisher: DomainEventPublisher,
  ) {}

  // tx (#141): si viene, se usa la transaccion del que llama; si no, una propia.
  async execute(command: MoveSlotCommand, tx?: UnitOfWorkTransaction): Promise<AvailabilitySlotId> {
    const slotId: AvailabilitySlotId = EntityId.from(command.slotId);
    const current = await this.availabilitySlotRepository.findById(slotId, tx);
    if (!current || current.status !== 'Active') {
      throw new AvailabilitySlotNotFoundError(command.slotId);
    }

    const replacement = AvailabilitySlot.occupy({
      companyId: current.companyId,
      resourceRef: current.resourceRef,
      dateRange: DateRange.from(command.startDate, command.endDate),
      slotKind: current.slotKind,
    });
    current.release();

    const write = async (writeTx: UnitOfWorkTransaction) => {
      await this.availabilitySlotRepository.save(current, writeTx);
      await this.availabilitySlotRepository.save(replacement, writeTx);
      for (const slot of [current, replacement]) {
        for (const event of slot.pullDomainEvents()) {
          await this.eventPublisher.publish(writeTx, {
            eventType: event.eventType,
            aggregateType: 'AvailabilitySlot',
            aggregateId: slot.id.toString(),
            companyId: slot.companyId,
            payload: { ...event },
          });
        }
      }
    };
    await (tx ? write(tx) : this.unitOfWork.run(write));

    return replacement.id;
  }
}
