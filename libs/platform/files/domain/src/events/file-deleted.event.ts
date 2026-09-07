// docs/model/06-DOMAIN_EVENTS.md SS8 - payload conceptual de FileDeleted.v1.
export interface FileDeletedEvent {
  eventType: 'FileDeleted.v1';
  fileId: string;
}
