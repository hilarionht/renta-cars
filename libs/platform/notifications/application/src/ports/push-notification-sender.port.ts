// Puerto separado de NotificationSenderPort (Hallazgo #9, Fase 3 item 1) - deviceToken en vez
// de Recipient de email/telefono. Sin consumidor real esta tanda (ningun listener dispara Push
// todavia, ver Hallazgo #11 del plan) - implementado (Expo) y bindeado en
// IntegrationProvidersModule de forma directa, sin useFactory fake/real (nada lo ejercita).
export const PUSH_NOTIFICATION_SENDER_PORT = Symbol('PushNotificationSenderPort');

export interface PushNotificationInput {
  deviceToken: string;
  title: string;
  body: string;
  data?: Record<string, string>;
}

export interface PushNotificationResult {
  providerReference: string;
}

export interface PushNotificationSenderPort {
  sendPush(input: PushNotificationInput): Promise<PushNotificationResult>;
}
