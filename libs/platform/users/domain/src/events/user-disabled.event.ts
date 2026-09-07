export interface UserDisabledEvent {
  eventType: 'UserDisabled.v1';
  userId: string;
  disabledBy: string;
  reason?: string;
}
