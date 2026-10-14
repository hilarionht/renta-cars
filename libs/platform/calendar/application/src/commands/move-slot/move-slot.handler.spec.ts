import {
  AvailabilitySlot,
  AvailabilitySlotNotFoundError,
  AvailabilitySlotOverlapError,
  ResourceRef,
} from '@platform/calendar/domain';
import { DateRange, type DomainEventPublisher, type UnitOfWork } from '@platform/shared-kernel';

import type { AvailabilitySlotRepository } from '../../ports/availability-slot.repository';
import { MoveSlotHandler } from './move-slot.handler';

// docs/persistence/10-DECISIONES.md #136.
function createSlot(): AvailabilitySlot {
  const slot = AvailabilitySlot.occupy({
    companyId: 'company-1',
    resourceRef: ResourceRef.from('vehicle', 'vehicle-1'),
    dateRange: DateRange.from(new Date('2026-03-01'), new Date('2026-03-10')),
    slotKind: { type: 'Booking', referenceId: 'reservation-1' },
  });
  slot.pullDomainEvents();
  slot.markPersisted();
  return slot;
}

function buildHandler(existingSlot: AvailabilitySlot | null) {
  const saved: AvailabilitySlot[] = [];
  const availabilitySlotRepository: AvailabilitySlotRepository = {
    findById: jest.fn().mockResolvedValue(existingSlot),
    save: jest.fn((slot: AvailabilitySlot) => {
      saved.push(slot);
      return Promise.resolve();
    }),
  };
  const unitOfWork: UnitOfWork = { run: jest.fn((work) => work({})) };
  const eventPublisher: DomainEventPublisher = { publish: jest.fn().mockResolvedValue(undefined) };
  const handler = new MoveSlotHandler(availabilitySlotRepository, unitOfWork, eventPublisher);
  return { handler, availabilitySlotRepository, unitOfWork, eventPublisher, saved };
}

describe('MoveSlotHandler', () => {
  it('en una sola transaccion libera el slot viejo y despues ocupa el nuevo, con el mismo recurso y referencia', async () => {
    const slot = createSlot();
    const { handler, unitOfWork, eventPublisher, saved } = buildHandler(slot);

    const newId = await handler.execute({
      slotId: slot.id.toString(),
      startDate: new Date('2026-03-01'),
      endDate: new Date('2026-03-12'),
    });

    expect(unitOfWork.run).toHaveBeenCalledTimes(1);
    expect(saved.map((s) => s.status)).toEqual(['Released', 'Active']);
    const replacement = saved[1];
    expect(replacement.id.toString()).toBe(newId.toString());
    expect(replacement.resourceRef.id).toBe('vehicle-1');
    expect(replacement.slotKind).toEqual({ type: 'Booking', referenceId: 'reservation-1' });
    expect(replacement.dateRange.end.toISOString()).toBe('2026-03-12T00:00:00.000Z');
    const published = (eventPublisher.publish as jest.Mock).mock.calls.map(
      (call: unknown[]) => (call[1] as { eventType: string }).eventType,
    );
    expect(published).toEqual(['AvailabilitySlotReleased.v1', 'AvailabilitySlotCreated.v1']);
  });

  it('si el rango nuevo choca con otro slot, el error sale de la transaccion (que vuelve atras)', async () => {
    const slot = createSlot();
    const { handler, availabilitySlotRepository } = buildHandler(slot);
    (availabilitySlotRepository.save as jest.Mock)
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new AvailabilitySlotOverlapError('vehicle', 'vehicle-1'));

    await expect(
      handler.execute({
        slotId: slot.id.toString(),
        startDate: new Date('2026-03-01'),
        endDate: new Date('2026-03-20'),
      }),
    ).rejects.toThrow(AvailabilitySlotOverlapError);
  });

  it('lanza AvailabilitySlotNotFoundError si el slot no existe o ya esta liberado', async () => {
    const released = createSlot();
    released.release();
    for (const existing of [null, released]) {
      const { handler } = buildHandler(existing);
      await expect(
        handler.execute({
          slotId: '018e5a00-0000-7000-8000-000000000000',
          startDate: new Date('2026-03-01'),
          endDate: new Date('2026-03-12'),
        }),
      ).rejects.toThrow(AvailabilitySlotNotFoundError);
    }
  });
});
