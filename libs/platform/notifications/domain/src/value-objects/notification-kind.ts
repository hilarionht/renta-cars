// docs/model/04-VALUE_OBJECTS.md SS7, docs/domain/02-LENGUAJE-UBICUO.md SS8 - catalogo
// cerrado de 4 valores. Alert: "reservar para notificaciones internas de operacion... no
// para comunicacion con el Customer".
export const NOTIFICATION_KINDS = ['Confirmation', 'Reminder', 'Receipt', 'Alert'] as const;

export type NotificationKindValue = (typeof NOTIFICATION_KINDS)[number];
