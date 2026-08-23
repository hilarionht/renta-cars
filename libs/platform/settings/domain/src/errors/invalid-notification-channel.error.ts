import { DomainError } from '@platform/shared-kernel';

export class InvalidNotificationChannelError extends DomainError {
  constructor(value: string) {
    super(
      `"${value}" no es un canal de notificacion valido (catalogo cerrado: WhatsApp, Email, SMS).`,
    );
  }
}
