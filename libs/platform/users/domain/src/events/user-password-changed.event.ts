export interface UserPasswordChangedEvent {
  eventType: 'UserPasswordChanged.v1';
  userId: string;
  changedBy: string;
}
