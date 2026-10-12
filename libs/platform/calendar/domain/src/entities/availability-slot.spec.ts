import { DateRange } from '@platform/shared-kernel';

import { ResourceRef } from '../value-objects/resource-ref';
import { AvailabilitySlot } from './availability-slot';

function occupySlot(): AvailabilitySlot {
  return AvailabilitySlot.occupy({
    companyId: 'company-1',
    resourceRef: ResourceRef.from('vehicle', 'vehicle-1'),
    dateRange: DateRange.from(new Date('2026-03-01'), new Date('2026-03-10')),
    slotKind: { type: 'Blackout', reason: 'mantenimiento' },
  });
}

describe('AvailabilitySlot', () => {
  describe('occupy', () => {
    it('crea el slot Active, version 1, y emite AvailabilitySlotCreated.v1', () => {
      const slot = occupySlot();

      expect(slot.status).toBe('Active');
      expect(slot.version).toBe(1);
      expect(slot.isNew).toBe(true);
      const events = slot.pullDomainEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        eventType: 'AvailabilitySlotCreated.v1',
        resourceType: 'vehicle',
        resourceId: 'vehicle-1',
        slotKind: 'Blackout',
      });
    });

    it('acepta un slot de tipo Booking con referenceId', () => {
      const slot = AvailabilitySlot.occupy({
        companyId: 'company-1',
        resourceRef: ResourceRef.from('vehicle', 'vehicle-1'),
        dateRange: DateRange.from(new Date('2026-03-01'), new Date('2026-03-10')),
        slotKind: { type: 'Booking', referenceId: 'reservation-1' },
      });

      expect(slot.slotKind).toEqual({ type: 'Booking', referenceId: 'reservation-1' });
    });
  });

  describe('release', () => {
    it('transiciona Active -> Released, bumpea version, y emite AvailabilitySlotReleased.v1', () => {
      const slot = occupySlot();
      slot.pullDomainEvents();

      slot.release();

      expect(slot.status).toBe('Released');
      expect(slot.version).toBe(2);
      const events = slot.pullDomainEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({ eventType: 'AvailabilitySlotReleased.v1' });
    });

    it('es idempotente si ya esta Released: no vuelve a bumpear version ni a emitir el evento', () => {
      const slot = occupySlot();
      slot.release();
      slot.pullDomainEvents();
      const versionAfterFirstRelease = slot.version;

      slot.release();

      expect(slot.version).toBe(versionAfterFirstRelease);
      expect(slot.pullDomainEvents()).toHaveLength(0);
    });
  });
});
