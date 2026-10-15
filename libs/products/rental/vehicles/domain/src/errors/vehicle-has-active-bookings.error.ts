import { DomainError } from '@platform/shared-kernel';

// docs/persistence/10-DECISIONES.md #137: programar mantenimiento, reportar un dano o marcar
// fuera de servicio dejaria sin auto a reservas confirmadas o en curso (por INV-009/INV-103
// el vehiculo queda bloqueado desde ya). Los ids viajan en el detail del problem details: el
// contrato de errores no admite campos extra. La web ya los muestra antes, desde el detalle
// del vehiculo.
export class VehicleHasActiveBookingsError extends DomainError {
  constructor(vehicleId: string, reservationIds: string[]) {
    super(
      `El vehicle "${vehicleId}" tiene reservas que quedarian sin auto: ${reservationIds.join(', ')}. ` +
        'Cambia el vehiculo de esas reservas o reprogramalas antes de continuar.',
    );
  }
}
