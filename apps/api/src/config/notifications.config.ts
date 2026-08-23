import { registerAs } from '@nestjs/config';

const DEFAULT_SENDER_PROVIDER = 'fake';

// Namespace "notifications" (NOTIFICATION_SENDER_PORT/PUSH_NOTIFICATION_SENDER_PORT,
// docs/11-INTEGRACIONES.md SS3-5). "fake" es el default de desarrollo/test - WhatsApp/
// SendGrid/Twilio/Expo requieren credenciales reales que este entorno no tiene (mismo
// criterio que Stripe/MercadoPago en payments.config.ts, docs/persistence/10-DECISIONES.md
// Fase 3, decision de alcance explicita del usuario). Todas las credenciales toleran vacio -
// ningun adaptador construye su cliente en el constructor (lazy-init), asi que el boot nunca
// falla por credenciales faltantes.
export default registerAs('notifications', () => ({
  senderProvider: process.env.NOTIFICATION_SENDER_PROVIDER ?? DEFAULT_SENDER_PROVIDER,
  whatsapp: {
    apiToken: process.env.WHATSAPP_API_TOKEN ?? '',
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID ?? '',
    webhookVerifyToken: process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN ?? '',
    webhookSecret: process.env.WHATSAPP_WEBHOOK_SECRET ?? '',
  },
  sendgrid: {
    apiKey: process.env.SENDGRID_API_KEY ?? '',
    fromEmail: process.env.SENDGRID_FROM_EMAIL ?? '',
  },
  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID ?? '',
    authToken: process.env.TWILIO_AUTH_TOKEN ?? '',
    fromNumber: process.env.TWILIO_FROM_NUMBER ?? '',
  },
  expo: {
    accessToken: process.env.EXPO_PUSH_ACCESS_TOKEN ?? '',
  },
}));
