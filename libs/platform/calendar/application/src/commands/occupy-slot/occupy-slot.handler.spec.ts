import type { AvailabilitySlot } from '@platform/calendar/domain';
import type { DomainEventPublisher, UnitOfWork } from '@platform/shared-kernel';

import { OccupySlotHandler } from './occupy-slot.handler';
import type { AvailabilitySlotRepository } from '../../ports/availability-slot.repository';

function buildHandler() {
  const savedSlots: AvailabilitySlot[] = [];
  const availabilitySlotRepository: AvailabilitySlotRepository = {
    findById: jest.fn(),
    save: jest.fn((slot: AvailabilitySlot) => {
      savedSlots.push(slot);
      return Promise.resolve();
    }),
  };
  const unitOfWork: UnitOfWork = { run: jest.fn((work) => work({})) };
  const eventPublisher: DomainEventPublisher = { publish: jest.fn().mockResolvedValue(undefined) };

  const handler = new OccupySlotHandler(availabilitySlotRepository, unitOfWork, eventPublisher);

  return { handler, availabilitySlotRepository, eventPublisher, savedSlots };
}

describe('OccupySlotHandler', () => {
  it('crea el slot, persiste y publica AvailabilitySlotCreated.v1', async () => {
    const { handler, availabilitySlotRepository, eventPublisher, savedSlots } = buildHandler();

    const slotId = await handler.execute({
      companyId: 'company-1',
      resourceType: 'vehicle',
      resourceId: 'vehicle-1',
      startDate: new Date('2026-03-01'),
      endDate: new Date('2026-03-10'),
      slotKind: { type: 'Blackout', reason: 'mantenimiento' },
    });

    expect(slotId.toString()).toBeDefined();
    expect(availabilitySlotRepository.save).toHaveBeenCalledTimes(1);
    expect(savedSlots).toHaveLength(1);
    expect(savedSlots[0].resourceRef.type).toBe('vehicle');
    expect(eventPublisher.publish).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        eventType: 'AvailabilitySlotCreated.v1',
        aggregateType: 'AvailabilitySlot',
      }),
    );
  });
});
