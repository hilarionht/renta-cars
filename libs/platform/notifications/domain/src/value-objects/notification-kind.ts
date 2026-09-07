// docs/model/04-VALUE_OBJECTS.md SS7, docs/domain/02-LENGUAJE-UBICUO.md SS8 - catalogo antes
// cerrado de 4 valores. Alert: "reservar para notificaciones internas de operacion... no
// para comunicacion con el Customer". SecurityCode agregado en Fase 5 cliente-autogestion
// (docs/persistence/10-DECISIONES.md #109) - ningun valor existente encaja para un OTP de
// login, ver el comentario del enum NotificationKind en prisma/schema/support.prisma.
// Cancellation agregado en #117 (Reservations->Notifications, mitad "cancelacion" del gap de
// #98) - mismo criterio: Confirmation es polaridad opuesta, Reminder es proactivo antes del
// evento no reactivo despues, Receipt es de pago, Alert esta reservado a operacion interna.
export const NOTIFICATION_KINDS = [
  'Confirmation',
  'Reminder',
  'Receipt',
  'Alert',
  'SecurityCode',
  'Cancellation',
] as const;

export type NotificationKindValue = (typeof NOTIFICATION_KINDS)[number];
