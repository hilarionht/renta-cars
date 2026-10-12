export interface SessionCreatedEvent {
  eventType: 'SessionCreated.v1';
  sessionId: string;
  userId: string;
  deviceUserAgent?: string;
  deviceIpAddress?: string;
}
