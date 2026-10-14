import { ApiError, NonexistentLocalTimeError } from '@frontend/data-access-core';

// Mensajes para el personal a partir del `code` del API (docs/contracts/07-ERROR-CATALOG.md),
// docs/persistence/10-DECISIONES.md #135. Sin code conocido, el detalle que manda el API.
const MESSAGES: Record<string, string> = {
  CONCURRENT_MODIFICATION:
    'Otra persona modificó esta reserva mientras tanto. Se recargaron los datos: revisalos y volvé a intentar.',
  INVALID_STATE_TRANSITION:
    'La reserva ya no está en un estado que permita esta acción. Se recargaron los datos.',
  CUSTOMER_NOT_ELIGIBLE:
    'El cliente no está habilitado para alquilar (registro incompleto o bloqueado).',
  DRIVER_NOT_VALIDATED: 'Hay conductores autorizados sin licencia validada.',
  BRANCH_CLOSED: 'La sucursal del vehículo está cerrada.',
  VEHICLE_NOT_AVAILABLE: 'El vehículo no está disponible en esas fechas.',
  RESERVATION_OVERLAP: 'El vehículo ya tiene otra reserva en esas fechas.',
  EXTENSION_COLLIDES: 'La extensión se superpone con otra reserva del vehículo.',
  INSPECTION_REQUIRED: 'Falta la inspección requerida para esta acción.',
  INVOICE_NOT_YET_ISSUED: 'La factura todavía no se emitió.',
  RESOURCE_NOT_FOUND: 'No se encontró el recurso (o no hay una tarifa vigente para el vehículo).',
  FORBIDDEN: 'No tenés permiso para esta acción.',
  RATE_LIMITED: 'Demasiadas solicitudes seguidas. Esperá unos segundos.',
  VALIDATION_FAILED: 'Hay datos inválidos en el formulario.',
};

// Codigos que implican que los datos en pantalla quedaron viejos.
export const STALE_DATA_CODES = new Set(['CONCURRENT_MODIFICATION', 'INVALID_STATE_TRANSITION']);

export function apiErrorMessage(error: unknown): string {
  if (error instanceof NonexistentLocalTimeError) {
    return 'Esa hora no existe en la zona de la sucursal (cambio de horario). Elegí otra.';
  }
  if (error instanceof ApiError) {
    return (
      (error.code && MESSAGES[error.code]) || error.message || 'Error inesperado del servidor.'
    );
  }
  return 'No se pudo completar la operación. Revisá la conexión e intentá de nuevo.';
}
