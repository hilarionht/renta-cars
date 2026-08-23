// Puerto de I/O externo (docs/ADR/0010-provider-pattern-integraciones.md,
// docs/11-INTEGRACIONES.md) - un unico puerto para los 3 canales de mensajeria
// (WhatsApp/Email/SMS, docs/contracts/05-INTEGRATION-CONTRACTS.md SS1). Push tiene su propio
// puerto separado (PushNotificationSenderPort) - deviceToken no es un Recipient de
// email/telefono. Implementado en platform-integration-providers-infrastructure
// (Fake/real compuesto por canal).
export const NOTIFICATION_SENDER_PORT = Symbol('NotificationSenderPort');

export interface NotificationSenderRecipient {
  email?: string;
  phone?: string;
}

export interface NotificationSenderInput {
  channel: 'WhatsApp' | 'Email' | 'SMS';
  recipient: NotificationSenderRecipient;
  templateId: string;
  templateParams: Record<string, string>;
  // notificationId/companyId viajan hasta el proveedor (p.ej. biz_opaque_callback_data de Meta
  // Cloud API) para que el webhook de confirmacion de entrega pueda correlacionar sin necesitar
  // un lookup por referencia opaca.
  notificationId: string;
  companyId: string;
}

export interface NotificationSenderResult {
  providerReference: string;
}

// send() lanza en fallo (nunca retorna un resultado "fallido") - SendNotificationHandler
// interpreta cualquier excepcion como "este canal no acepto el mensaje, probar el siguiente".
export interface NotificationSenderPort {
  send(input: NotificationSenderInput): Promise<NotificationSenderResult>;
}
