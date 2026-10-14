import type { ReservationStatus } from '@frontend/domain-types';

// Estados y acciones de una reserva en la web (docs/persistence/10-DECISIONES.md #135). La
// tabla replica las transiciones validas de libs/products/rental/reservations/domain/src/
// entities/reservation.ts: la UI solo ofrece lo que el dominio acepta, y el API sigue siendo
// quien decide (INVALID_STATE_TRANSITION si algo cambio mientras tanto).
export type BadgeToneName = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

export const RESERVATION_STATUS_LABELS: Record<ReservationStatus, string> = {
  Draft: 'Borrador',
  Confirmed: 'Confirmada',
  CheckedOut: 'En alquiler',
  CheckedIn: 'Devuelta',
  Closed: 'Cerrada',
  Cancelled: 'Cancelada',
};

export const RESERVATION_STATUS_TONES: Record<ReservationStatus, BadgeToneName> = {
  Draft: 'neutral',
  Confirmed: 'info',
  CheckedOut: 'warning',
  CheckedIn: 'success',
  Closed: 'success',
  Cancelled: 'danger',
};

export const RESERVATION_STATUSES = Object.keys(RESERVATION_STATUS_LABELS) as ReservationStatus[];

export function reservationStatusLabel(status: string): string {
  return RESERVATION_STATUS_LABELS[status as ReservationStatus] ?? status;
}

export function reservationStatusTone(status: string): BadgeToneName {
  return RESERVATION_STATUS_TONES[status as ReservationStatus] ?? 'neutral';
}

export type ReservationUiAction =
  | 'confirm'
  | 'cancel'
  | 'reschedule'
  | 'check-out'
  | 'mark-no-show'
  | 'check-in'
  | 'extend'
  | 'swap-vehicle';

// Permiso del catalogo que habilita cada accion. "extend" agrupa pedir y aprobar extension:
// se muestra si el usuario puede alguna de las dos.
export const ACTION_PERMISSIONS: Record<ReservationUiAction, readonly string[]> = {
  confirm: ['reservations:confirm'],
  cancel: ['reservations:cancel'],
  reschedule: ['reservations:reschedule'],
  'check-out': ['reservations:check-out'],
  'mark-no-show': ['reservations:mark-no-show'],
  'check-in': ['reservations:check-in'],
  extend: ['reservations:request-extension', 'reservations:approve-extension'],
  'swap-vehicle': ['reservations:swap-vehicle'],
};

const ACTIONS_BY_STATUS: Record<ReservationStatus, readonly ReservationUiAction[]> = {
  Draft: ['confirm', 'reschedule', 'cancel'],
  Confirmed: ['check-out', 'reschedule', 'mark-no-show', 'cancel'],
  CheckedOut: ['check-in', 'extend', 'swap-vehicle'],
  CheckedIn: [],
  Closed: [],
  Cancelled: [],
};

/**
 * Acciones que se ofrecen para una reserva. No-show solo despues del inicio: el dominio no lo
 * restringe por fecha, pero marcar como no presentado a alguien que todavia puede llegar es
 * un error de operacion.
 */
export function availableActions(
  reservation: { status: string; startDate: string },
  hasAnyPermission: (permissions: readonly string[]) => boolean,
  now: Date = new Date(),
): ReservationUiAction[] {
  const byStatus = ACTIONS_BY_STATUS[reservation.status as ReservationStatus] ?? [];
  return byStatus.filter((action) => {
    if (action === 'mark-no-show' && now.getTime() < new Date(reservation.startDate).getTime()) {
      return false;
    }
    return hasAnyPermission(ACTION_PERMISSIONS[action]);
  });
}
