import { Inject, Injectable } from '@nestjs/common';

import {
  DateRange,
  DOMAIN_EVENT_PUBLISHER,
  type DomainEventPublisher,
  UNIT_OF_WORK,
  type UnitOfWork,
  type UnitOfWorkTransaction,
} from '@platform/shared-kernel';
import { AvailabilitySlot, type AvailabilitySlotId, ResourceRef } from '@platform/calendar/domain';

import {
  AVAILABILITY_SLOT_REPOSITORY,
  type AvailabilitySlotRepository,
} from '../../ports/availability-slot.repository';
import type { OccupySlotCommand } from './occupy-slot.command';

// Sin pre-chequeo de solapamiento en memoria - a diferencia de VehicleCategory.addRate(),
// AvailabilitySlot no reconstituye un historial de otros slots al crearse. La "doble capa"
// de INV-013/INV-102 es AvailabilityService (aplicacion, futuro modulo reservations, capa 1)
// + la exclusion constraint GiST de este modulo (capa 2, la unica que Calendar aporta) - el
// repositorio captura la violacion (ver PrismaAvailabilitySlotRepository).
@Injectable()
export class OccupySlotHandler {
  constructor(
    @Inject(AVAILABILITY_SLOT_REPOSITORY)
    private readonly availabilitySlotRepository: AvailabilitySlotRepository,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(DOMAIN_EVENT_PUBLISHER) private readonly eventPublisher: DomainEventPublisher,
  ) {}

  // tx (#141): si viene, se usa la transaccion del que llama; si no, una propia.
  async execute(
    command: OccupySlotCommand,
    tx?: UnitOfWorkTransaction,
  ): Promise<AvailabilitySlotId> {
    const slot = AvailabilitySlot.occupy({
      companyId: command.companyId,
      resourceRef: ResourceRef.from(command.resourceType, command.resourceId),
      dateRange: DateRange.from(command.startDate, command.endDate),
      slotKind: command.slotKind,
    });

    const write = async (writeTx: UnitOfWorkTransaction) => {
      await this.availabilitySlotRepository.save(slot, writeTx);
      for (const event of slot.pullDomainEvents()) {
        await this.eventPublisher.publish(writeTx, {
          eventType: event.eventType,
          aggregateType: 'AvailabilitySlot',
          aggregateId: slot.id.toString(),
          companyId: slot.companyId,
          payload: { ...event },
        });
      }
    };
    await (tx ? write(tx) : this.unitOfWork.run(write));

    return slot.id;
  }
}
