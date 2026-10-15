import type {
  VehicleActiveReservation,
  VehicleDocument,
  VehicleStatus,
  VehicleSummary,
} from '@frontend/domain-types';

import type { BadgeToneName } from './reservation-status';

// Estados y acciones de un vehiculo en la web (docs/persistence/10-DECISIONES.md #137). La tabla
// replica las transiciones de libs/products/rental/vehicles/domain/src/entities/vehicle.ts y de
// docs/model/08-STATE_MACHINES.md SS2; el API sigue siendo quien decide.
export const VEHICLE_STATUS_LABELS: Record<VehicleStatus, string> = {
  Registered: 'Registrado',
  Available: 'Disponible',
  Reserved: 'Reservado',
  CheckedOut: 'En alquiler',
  Maintenance: 'En mantenimiento',
  OutOfService: 'Fuera de servicio',
};

const VEHICLE_STATUS_TONES: Record<VehicleStatus, BadgeToneName> = {
  Registered: 'neutral',
  Available: 'success',
  Reserved: 'info',
  CheckedOut: 'warning',
  Maintenance: 'warning',
  OutOfService: 'danger',
};

export interface DisplayStatus {
  key: VehicleStatus;
  label: string;
  tone: BadgeToneName;
}

/**
 * Estado que se muestra. El vehiculo nunca pasa a CheckedOut por si mismo (#137): si esta
 * Available y tiene una reserva CheckedOut, se muestra "En alquiler".
 */
export function displayVehicleStatus(
  vehicle: Pick<VehicleSummary, 'status' | 'activeReservation'>,
): DisplayStatus {
  const key: VehicleStatus =
    vehicle.status === 'Available' && vehicle.activeReservation?.status === 'CheckedOut'
      ? 'CheckedOut'
      : (vehicle.status as VehicleStatus);
  return {
    key,
    label: VEHICLE_STATUS_LABELS[key] ?? vehicle.status,
    tone: VEHICLE_STATUS_TONES[key] ?? 'neutral',
  };
}

// Valores del filtro del listado: los estados reales que alcanza un vehiculo mas "En alquiler"
// derivado. Reserved no se ofrece (nunca se asigna).
export const VEHICLE_FILTER_STATUSES: readonly VehicleStatus[] = [
  'Registered',
  'Available',
  'CheckedOut',
  'Maintenance',
  'OutOfService',
];

export type VehicleUiAction =
  'enable' | 'schedule-maintenance' | 'report-damage' | 'mark-out-of-service';

const ACTIONS_BY_STATUS: Record<VehicleStatus, readonly VehicleUiAction[]> = {
  Registered: ['enable'],
  Available: ['schedule-maintenance', 'report-damage', 'mark-out-of-service'],
  OutOfService: ['schedule-maintenance'],
  Maintenance: [],
  Reserved: [],
  CheckedOut: [],
};

/** Todas requieren vehicles:manage. */
export function availableVehicleActions(status: string, canManage: boolean): VehicleUiAction[] {
  if (!canManage) {
    return [];
  }
  return [...(ACTIONS_BY_STATUS[status as VehicleStatus] ?? [])];
}

export function isDocumentExpired(document: Pick<VehicleDocument, 'expiryDate'>, now = new Date()) {
  return new Date(document.expiryDate).getTime() < now.getTime();
}

export const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  PropertyCard: 'Tarjeta de propiedad',
  Insurance: 'Seguro',
  CirculationPermit: 'Permiso de circulación',
};

export const MAINTENANCE_TYPE_LABELS: Record<string, string> = {
  Preventive: 'Preventivo',
  Corrective: 'Correctivo',
};

export const MAINTENANCE_STATUS_LABELS: Record<string, string> = {
  Scheduled: 'Programado',
  InProgress: 'En curso',
  Completed: 'Completado',
};

export const DOCUMENT_STATUS_LABELS: Record<string, string> = {
  Pending: 'Pendiente',
  Verified: 'Verificado',
  Expired: 'Vencido',
};

// Misma regla que ActiveBookingsGuard en el API (#137): el bloqueo empieza ya, asi que choca
// toda reserva activa que empiece antes de que termine. blockedUntil null = sin fin (dano grave,
// fuera de servicio). La web la usa para mostrar las reservas afectadas ANTES de confirmar; el
// API vuelve a verificar y responde 409 si algo cambio.
export const CORRECTIVE_WINDOW_DAYS = 7;

export function blockingReservations(
  reservations: readonly VehicleActiveReservation[] | undefined,
  blockedUntil: Date | null,
): VehicleActiveReservation[] {
  return (reservations ?? []).filter(
    (reservation) =>
      blockedUntil === null || new Date(reservation.startDate).getTime() < blockedUntil.getTime(),
  );
}
