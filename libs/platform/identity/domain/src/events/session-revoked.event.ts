export interface SessionRevokedEvent {
  eventType: 'SessionRevoked.v1';
  sessionId: string;
  userId: string;
  reason: string;
}
