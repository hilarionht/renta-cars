// docs/model/06-DOMAIN_EVENTS.md SS5 - payload conceptual de AvailabilitySlotCreated.v1.
export interface AvailabilitySlotCreatedEvent {
  eventType: 'AvailabilitySlotCreated.v1';
  slotId: string;
  resourceType: string;
  resourceId: string;
  dateRange: { start: string; end: string };
  slotKind: string;
}
