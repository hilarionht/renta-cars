import type { NotificationKindValue } from '@platform/notifications/domain';

export interface SendNotificationCommand {
  companyId: string;
  kind: NotificationKindValue;
  recipient: { email?: string; phone?: string; deviceToken?: string };
  templateId: string;
  templateParams?: Record<string, string>;
  // Fase 5 cliente-autogestion (docs/persistence/10-DECISIONES.md #109) - si se pasa, intenta
  // SOLO ese canal, sin fallback (ver CHANNEL_PRIORITY en send-notification.handler.ts). Los
  // callers existentes (listeners fire-and-forget) nunca lo pasan, asi que su comportamiento
  // no cambia. Lanza NotificationDeliveryFailedError si ese canal especifico falla - unico
  // caso en que este handler tira en vez de marcar Notification.fail() y devolver.
  requireExactChannel?: 'WhatsApp' | 'Email' | 'SMS';
}
