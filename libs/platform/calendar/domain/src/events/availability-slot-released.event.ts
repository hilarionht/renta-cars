export interface AvailabilitySlotReleasedEvent {
  eventType: 'AvailabilitySlotReleased.v1';
  slotId: string;
  resourceType: string;
  resourceId: string;
}
