import { ConcurrentModificationError, type DomainErrorEntries } from '@platform/shared-kernel';
import {
  NotificationInvalidStateTransitionError,
  NotificationNotFoundError,
} from '@platform/notifications/domain';

// docs/contracts/07-ERROR-CATALOG.md - codigos reutilizados (INVALID_STATE_TRANSITION,
// RESOURCE_NOT_FOUND, CONCURRENT_MODIFICATION), sin codigos nuevos - NOTIFICATION_CHANNEL_
// UNAVAILABLE nunca se expone como error HTTP sincrono (se traduce a NotificationFailed.v1,
// Hallazgo #14 del plan).
export const NOTIFICATIONS_DOMAIN_ERROR_ENTRIES: DomainErrorEntries = [
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
];
