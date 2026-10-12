// docs/model/06-DOMAIN_EVENTS.md SS8 - payload conceptual de FileUploaded.v1.
export interface FileUploadedEvent {
  eventType: 'FileUploaded.v1';
  fileId: string;
  contentType: string;
  uploadedBy: string;
}
