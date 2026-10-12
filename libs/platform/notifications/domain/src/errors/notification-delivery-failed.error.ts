import { DomainError } from '@platform/shared-kernel';

// Fase 5 cliente-autogestion (docs/persistence/10-DECISIONES.md #109) - unico caso en que
// SendNotificationHandler.execute() tira en vez de marcar Notification.fail() y devolver
// normalmente (comportamiento fire-and-forget de siempre, ver notification.ts). Se activa
// solo cuando el caller pasa requireExactChannel (hoy: OTP por WhatsApp, donde un fallback
// silencioso a Email/SMS violaria el diseño "sin password, por WhatsApp") - los 2 listeners
// existentes nunca pasan ese campo, asi que nunca ven esta excepcion.
export class NotificationDeliveryFailedError extends DomainError {
  constructor(channel: string, reason: string) {
    super(`No se pudo enviar la notificacion por el canal "${channel}": ${reason}`);
  }
}
