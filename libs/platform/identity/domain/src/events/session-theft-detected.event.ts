export interface SessionTheftDetectedEvent {
  eventType: 'SessionTheftDetected.v1';
  userId: string;
  affectedSessionIds: string[];
}
