import { Inject, Injectable } from '@nestjs/common';

import {
  DOMAIN_EVENT_PUBLISHER,
  type DomainEventPublisher,
  EntityId,
  UNIT_OF_WORK,
  type UnitOfWork,
} from '@platform/shared-kernel';
import { type AvailabilitySlotId, AvailabilitySlotNotFoundError } from '@platform/calendar/domain';

import {
  AVAILABILITY_SLOT_REPOSITORY,
  type AvailabilitySlotRepository,
} from '../../ports/availability-slot.repository';
import type { ReleaseSlotCommand } from './release-slot.command';

@Injectable()
export class ReleaseSlotHandler {
  constructor(
    @Inject(AVAILABILITY_SLOT_REPOSITORY)
    private readonly availabilitySlotRepository: AvailabilitySlotRepository,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
    @Inject(DOMAIN_EVENT_PUBLISHER) private readonly eventPublisher: DomainEventPublisher,
  ) {}

  async execute(command: ReleaseSlotCommand): Promise<void> {
    const slotId: AvailabilitySlotId = EntityId.from(command.slotId);
    const slot = await this.availabilitySlotRepository.findById(slotId);
    if (!slot) {
      throw new AvailabilitySlotNotFoundError(command.slotId);
    }

    const versionBeforeRelease = slot.version;
    slot.release();
    if (slot.version === versionBeforeRelease) {
      // release() fue un no-op idempotente (ya estaba Released) - nada que persistir.
      // PrismaAvailabilitySlotRepository.save() asume que TODA llamada con isNew=false
      // bumpeo version respecto de lo ya guardado (updateMany con version-1 como guarda);
      // llamar a save() aca lanzaria un ConcurrentModificationError espurio, sin que haya
      // habido ninguna concurrencia real (ver docs/persistence/10-DECISIONES.md #56).
      return;
    }

    await this.unitOfWork.run(async (tx) => {
      await this.availabilitySlotRepository.save(slot, tx);
      for (const event of slot.pullDomainEvents()) {
        await this.eventPublisher.publish(tx, {
          eventType: event.eventType,
          aggregateType: 'AvailabilitySlot',
          aggregateId: slot.id.toString(),
          companyId: slot.companyId,
          payload: { ...event },
        });
      }
    });
  }
}
