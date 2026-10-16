import { Inject, Injectable } from '@nestjs/common';

import { CALENDAR_PORT, type CalendarPort } from '@platform/calendar/application';
import type { UnitOfWorkTransaction } from '@platform/shared-kernel';
import { VehicleHasActiveBookingsError } from '@rental/vehicles/domain';

// docs/persistence/10-DECISIONES.md #137: un vehiculo en Maintenance/OutOfService no puede
// hacer check-out (INV-103), y el bloqueo empieza YA, no en la ventana del mantenimiento
// (INV-009). Por eso una reserva queda sin auto si su ocupacion empieza antes de que termine
// el bloqueo. Una CheckedOut conserva su slot Booking hasta el check-in, asi que tambien
// cuenta. Los Blackout no (CalendarPort.findActiveBookings ya los excluye).
//
// Se consulta el calendario (la ACL que vehicles ya usa) y no las reservas: el lado de
// comandos no lee otro modulo. Desde #141, el que llama toma antes el lock exclusivo del
// vehiculo (vehicleLockKey) y pasa su tx: chequeo y guardado son atomicos frente a confirmar,
// cambiar de vehiculo, reprogramar y extender, que toman el mismo lock compartido.
@Injectable()
export class ActiveBookingsGuard {
  constructor(@Inject(CALENDAR_PORT) private readonly calendarPort: CalendarPort) {}

  /** blockedUntil null = bloqueo sin fin (fuera de servicio): cualquier reserva activa choca. */
  async assertNoneBlocked(params: {
    companyId: string;
    vehicleId: string;
    blockedUntil: Date | null;
    tx: UnitOfWorkTransaction;
  }): Promise<void> {
    const bookings = await this.calendarPort.findActiveBookings(
      params.companyId,
      'vehicle',
      params.vehicleId,
      params.tx,
    );
    const blocked = bookings.filter(
      (booking) =>
        params.blockedUntil === null || booking.startDate.getTime() < params.blockedUntil.getTime(),
    );
    if (blocked.length > 0) {
      throw new VehicleHasActiveBookingsError(
        params.vehicleId,
        blocked.map((booking) => booking.referenceId),
      );
    }
  }
}
