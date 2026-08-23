import { InvalidNotificationChannelError } from '../errors/invalid-notification-channel.error';

// docs/model/04-VALUE_OBJECTS.md SS3 (Organization), RN-33: "canal preferido de notificacion
// (WhatsApp, Email, SMS) configurable por Customer y/o por Company". Solo 3 valores, no los 4
// del catalogo Channel de Notification - Push queda fuera de la preferencia/fallback (usa
// deviceToken, no email/telefono, es un mecanismo separado - docs/persistence/10-DECISIONES.md
// Fase 3, Hallazgo #9). Sin consumidor real hasta esta tanda (Notifications, Fase 3 item 1) -
// mismo patron forward-looking que DepositPolicy antes de Payments.
export const NOTIFICATION_CHANNELS = ['WhatsApp', 'Email', 'SMS'] as const;

export type NotificationChannelValue = (typeof NOTIFICATION_CHANNELS)[number];

export class NotificationChannelPreference {
  private constructor(private readonly value: NotificationChannelValue) {}

  static from(raw: string): NotificationChannelPreference {
    if (!(NOTIFICATION_CHANNELS as readonly string[]).includes(raw)) {
      throw new InvalidNotificationChannelError(raw);
    }
    return new NotificationChannelPreference(raw as NotificationChannelValue);
  }

  // Email por default - pragmatico, sin requerir aprobacion de plantillas como WhatsApp
  // (docs/persistence/10-DECISIONES.md Fase 3).
  static default(): NotificationChannelPreference {
    return new NotificationChannelPreference('Email');
  }

  toString(): string {
    return this.value;
  }
}
