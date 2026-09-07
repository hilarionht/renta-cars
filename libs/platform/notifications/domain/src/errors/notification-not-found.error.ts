import { DomainError } from '@platform/shared-kernel';

export class NotificationNotFoundError extends DomainError {
  constructor(notificationId: string) {
    super(`No existe la notification "${notificationId}".`);
  }
}
