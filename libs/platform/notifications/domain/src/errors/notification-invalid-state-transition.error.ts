import { DomainError } from '@platform/shared-kernel';

// docs/model/08-STATE_MACHINES.md SS6.10 - transiciones explicitamente invalidas de
// Notification.
export class NotificationInvalidStateTransitionError extends DomainError {
  constructor(notificationId: string, from: string, action: string) {
    super(`La notification "${notificationId}" no puede "${action}" estando en estado "${from}".`);
  }
}
