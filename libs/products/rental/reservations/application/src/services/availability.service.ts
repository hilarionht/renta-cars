import { Inject, Injectable } from '@nestjs/common';

import { CALENDAR_PORT, type CalendarPort } from '@platform/calendar/application';
import { DateRange, type UnitOfWorkTransaction } from '@platform/shared-kernel';
import { VEHICLE_STATUS_PORT, type VehicleStatusPort } from '@rental/vehicles/application';
import { ReservationOverlapError } from '@rental/reservations/domain';

// Nombre de la excepcion real lanzada por Scheduling al perder la carrera contra la
// exclusion constraint GiST (AvailabilitySlotOverlapError, platform-calendar-domain). No se
// importa la clase - reservations/application no puede depender de type:domain de otro
// modulo (tooling/eslint/boundaries.mjs, INV-P03) - se distingue por `.name`, el mismo
// patron de traduccion de error que una Anti-Corruption Layer real usa cuando no puede
// tipar la excepcion de origen.
const AVAILABILITY_SLOT_OVERLAP_ERROR_NAME = 'AvailabilitySlotOverlapError';

// AvailabilityService (docs/model/05-DOMAIN_SERVICES.md SS1) - la Anti-Corruption Layer
// formal entre Rental Operations y Scheduling (docs/model/01-BOUNDED_CONTEXTS.md SS4.2).
// Vive en application/ de reservations, no en domain/, porque coordina un puerto hacia otro
// Bounded Context. Nunca escribe directamente en AvailabilitySlot fuera de CalendarPort.
@Injectable()
export class AvailabilityService {
  constructor(
    @Inject(VEHICLE_STATUS_PORT) private readonly vehicleStatusPort: VehicleStatusPort,
    @Inject(CALENDAR_PORT) private readonly calendarPort: CalendarPort,
  ) {}

  // Un Vehicle en Maintenance/OutOfService es "no disponible" incluso si Scheduling no
  // tiene ningun AvailabilitySlot activo para el (RN-04) - combina ambas fuentes, ninguna
  // por si sola basta.
  // excludeReservationId (docs/persistence/10-DECISIONES.md #136): al reprogramar o extender,
  // el slot de la propia reserva no cuenta como ocupacion (si no, choca consigo misma).
  async isAvailable(
    vehicleId: string,
    range: DateRange,
    excludeReservationId?: string,
  ): Promise<boolean> {
    const isOperational = await this.vehicleStatusPort.isOperational(vehicleId);
    if (!isOperational) {
      return false;
    }
    return this.calendarPort.isAvailable(
      'vehicle',
      vehicleId,
      range.start,
      range.end,
      excludeReservationId,
    );
  }

  // Traduce a CalendarPort.occupy() - lanza AvailabilitySlotOverlapError (propagada desde
  // Scheduling) si perdio la carrera entre el pre-check y este momento (docs/domain/
  // 03-PROCESOS.md SS3). companyId explicito (a diferencia de isAvailable/release, que lo
  // resuelven via RequestContext dentro del adapter) porque OccupySlotParams lo exige.
  async reserve(
    companyId: string,
    vehicleId: string,
    range: DateRange,
    reservationId: string,
    // #141: la transaccion de la reserva (ocupacion y reserva se confirman o revierten juntas).
    tx?: UnitOfWorkTransaction,
  ): Promise<void> {
    try {
      await this.calendarPort.occupy(
        {
          companyId,
          resourceType: 'vehicle',
          resourceId: vehicleId,
          startDate: range.start,
          endDate: range.end,
          slotKind: { type: 'Booking', referenceId: reservationId },
        },
        tx,
      );
    } catch (error) {
      if (error instanceof Error && error.name === AVAILABILITY_SLOT_OVERLAP_ERROR_NAME) {
        throw new ReservationOverlapError(vehicleId);
      }
      throw error;
    }
  }

  // No-op si no hay ningun AvailabilitySlot Active de ESTA reserva para el Vehicle (ya
  // liberado, o nunca se ocupo - p. ej. cancelar un Draft, ver Hallazgo #4 del plan de
  // implementacion). Por reservationId, nunca solo por vehiculo: un vehiculo tiene un slot
  // Active por cada reserva futura (docs/persistence/10-DECISIONES.md #132).
  async release(
    vehicleId: string,
    reservationId: string,
    tx?: UnitOfWorkTransaction,
  ): Promise<void> {
    const slotId = await this.calendarPort.findActiveSlotId(
      'vehicle',
      vehicleId,
      reservationId,
      tx,
    );
    if (!slotId) {
      return;
    }
    await this.calendarPort.release(slotId, tx);
  }

  // reschedule()/approveExtension() mueven la ventana ocupada del MISMO vehicleId (a
  // diferencia de swapVehicle, que ocupa un vehicleId distinto). docs/persistence/
  // 10-DECISIONES.md #136: CalendarPort.move() libera el slot viejo y ocupa el nuevo en una
  // sola transaccion. Antes se ocupaba el nuevo ANTES de liberar el viejo (dos transacciones)
  // y la exclusion GiST lo rechazaba siempre que los rangos se superpusieran - una extension
  // siempre se superpone (mismo inicio), asi que aprobar extensiones nunca funcionaba.
  // Sin slot activo (p.ej. un Draft, que nunca ocupo) se ocupa directamente.
  async moveOccupancy(
    companyId: string,
    vehicleId: string,
    newRange: DateRange,
    reservationId: string,
    tx?: UnitOfWorkTransaction,
  ): Promise<void> {
    const oldSlotId = await this.calendarPort.findActiveSlotId(
      'vehicle',
      vehicleId,
      reservationId,
      tx,
    );
    if (!oldSlotId) {
      await this.reserve(companyId, vehicleId, newRange, reservationId, tx);
      return;
    }
    try {
      await this.calendarPort.move(oldSlotId, newRange.start, newRange.end, tx);
    } catch (error) {
      if (error instanceof Error && error.name === AVAILABILITY_SLOT_OVERLAP_ERROR_NAME) {
        throw new ReservationOverlapError(vehicleId);
      }
      throw error;
    }
  }
}
