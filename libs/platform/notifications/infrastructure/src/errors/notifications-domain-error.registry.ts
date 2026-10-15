import {
  ConcurrentModificationError,
  type DomainErrorEntries,
  InvalidValueError,
} from '@platform/shared-kernel';
import {
  NotificationDeliveryFailedError,
  NotificationInvalidStateTransitionError,
  NotificationNotFoundError,
} from '@platform/notifications/domain';

// docs/contracts/07-ERROR-CATALOG.md - codigos reutilizados (INVALID_STATE_TRANSITION,
// RESOURCE_NOT_FOUND, CONCURRENT_MODIFICATION) salvo NOTIFICATION_CHANNEL_DELIVERY_FAILED
// (nuevo, Fase 5 cliente-autogestion #109) - unico caso en que SendNotificationHandler tira
// en vez de traducir el fallo a NotificationFailed.v1 silencioso (requireExactChannel).
export const NOTIFICATIONS_DOMAIN_ERROR_ENTRIES: DomainErrorEntries = [
  // #139 (patron de #137): VO con dato de entrada invalido (antes TypeError crudo -> 500).
  [
    InvalidValueError,
    { status: 400, code: 'INVALID_VALUE', title: 'Un valor de la solicitud no es valido' },
  ],
  [
    NotificationInvalidStateTransitionError,
    { status: 409, code: 'INVALID_STATE_TRANSITION', title: 'Transicion de estado invalida' },
  ],
  [
    NotificationNotFoundError,
    { status: 404, code: 'RESOURCE_NOT_FOUND', title: 'Notification no encontrada' },
  ],
  [
    ConcurrentModificationError,
    { status: 409, code: 'CONCURRENT_MODIFICATION', title: 'Modificacion concurrente' },
  ],
  [
    NotificationDeliveryFailedError,
    {
      status: 503,
      code: 'NOTIFICATION_CHANNEL_DELIVERY_FAILED',
      title: 'No se pudo enviar la notificacion por el canal requerido',
    },
  ],
];
