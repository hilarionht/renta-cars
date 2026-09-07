// deviceToken: string | null - null limpia el token (docs/persistence/10-DECISIONES.md #122,
// SendReservationReminderProcessor lo llama con null cuando Expo confirma DeviceNotRegistered).
// La ruta HTTP (PATCH /me/push-token) siempre manda un string, nunca null.
export interface RegisterCustomerPushTokenCommand {
  customerId: string;
  companyId: string;
  deviceToken: string | null;
}
