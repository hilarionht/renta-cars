import { DomainError } from '@platform/shared-kernel';

// docs/persistence/10-DECISIONES.md #122 - PushSenderAdapter (integration-providers) la tira
// cuando Expo confirma DeviceNotRegistered (el cliente desinstalo la app / el token quedo
// invalido para siempre) - distinta de un Error generico (fallo transitorio, no se limpia el
// token). Nunca cruza un limite HTTP (Push corre solo desde jobs de BullMQ hoy, ver
// SendReservationReminderProcessor) - sin entrada en NOTIFICATIONS_DOMAIN_ERROR_ENTRIES a
// proposito, ningun filtro de excepciones HTTP la ve nunca.
export class PushTokenInvalidError extends DomainError {
  constructor(reason: string) {
    super(`El deviceToken de push quedo invalido: ${reason}`);
  }
}
