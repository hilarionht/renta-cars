import {
  AvailabilitySlot,
  AvailabilitySlotNotFoundError,
  ResourceRef,
} from '@platform/calendar/domain';
import { DateRange, type DomainEventPublisher, type UnitOfWork } from '@platform/shared-kernel';

import { ReleaseSlotHandler } from './release-slot.handler';
import type { AvailabilitySlotRepository } from '../../ports/availability-slot.repository';

const UNKNOWN_ID = '018e5a00-0000-7000-8000-000000000000';

function createSlot(): AvailabilitySlot {
  return AvailabilitySlot.occupy({
    companyId: 'company-1',
    resourceRef: ResourceRef.from('vehicle', 'vehicle-1'),
    dateRange: DateRange.from(new Date('2026-03-01'), new Date('2026-03-10')),
    slotKind: { type: 'Blackout', reason: 'mantenimiento' },
  });
}

function buildHandler(existingSlot: AvailabilitySlot | null) {
  const availabilitySlotRepository: AvailabilitySlotRepository = {
    findById: jest.fn().mockResolvedValue(existingSlot),
    save: jest.fn().mockResolvedValue(undefined),
  };
  const unitOfWork: UnitOfWork = { run: jest.fn((work) => work({})) };
  const eventPublisher: DomainEventPublisher = { publish: jest.fn().mockResolvedValue(undefined) };

  const handler = new ReleaseSlotHandler(availabilitySlotRepository, unitOfWork, eventPublisher);

  return { handler, availabilitySlotRepository, eventPublisher };
}

describe('ReleaseSlotHandler', () => {
  it('lanza AvailabilitySlotNotFoundError si el slot no existe', async () => {
    const { handler } = buildHandler(null);

    await expect(handler.execute({ slotId: UNKNOWN_ID })).rejects.toThrow(
      AvailabilitySlotNotFoundError,
    );
  });

  it('libera el slot, persiste y publica AvailabilitySlotReleased.v1', async () => {
    const slot = createSlot();
    const { handler, availabilitySlotRepository, eventPublisher } = buildHandler(slot);

    await handler.execute({ slotId: slot.id.toString() });

    expect(slot.status).toBe('Released');
    expect(availabilitySlotRepository.save).toHaveBeenCalledTimes(1);
    expect(eventPublisher.publish).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ eventType: 'AvailabilitySlotReleased.v1' }),
    );
  });

  // Regresion del bug real docs/persistence/10-DECISIONES.md #56: liberar un slot ya
  // Released es idempotente y no bumpea version - save() debe saltearse por completo.
  it('segunda llamada sobre un slot ya Released es idempotente: no llama a save()', async () => {
    const slot = createSlot();
    slot.release();
    const { handler, availabilitySlotRepository, eventPublisher } = buildHandler(slot);

    await handler.execute({ slotId: slot.id.toString() });

    expect(availabilitySlotRepository.save).not.toHaveBeenCalled();
    expect(eventPublisher.publish).not.toHaveBeenCalled();
  });
});
