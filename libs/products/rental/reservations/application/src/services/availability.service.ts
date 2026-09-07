import { Inject, Injectable } from '@nestjs/common';

import { CALENDAR_PORT, type CalendarPort } from '@platform/calendar/application';
import { DateRange } from '@platform/shared-kernel';
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
  async isAvailable(vehicleId: string, range: DateRange): Promise<boolean> {
    const isOperational = await this.vehicleStatusPort.isOperational(vehicleId);
    if (!isOperational) {
      return false;
    }
    return this.calendarPort.isAvailable('vehicle', vehicleId, range.start, range.end);
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
  ): Promise<void> {
    try {
      await this.calendarPort.occupy({
        companyId,
        resourceType: 'vehicle',
        resourceId: vehicleId,
        startDate: range.start,
        endDate: range.end,
        slotKind: { type: 'Booking', referenceId: reservationId },
      });
    } catch (error) {
      if (error instanceof Error && error.name === AVAILABILITY_SLOT_OVERLAP_ERROR_NAME) {
        throw new ReservationOverlapError(vehicleId);
      }
      throw error;
    }
  }

  // No-op si no hay ningun AvailabilitySlot Active para el Vehicle (ya liberado, o nunca
  // se ocupo - p. ej. cancelar un Draft, ver Hallazgo #4 del plan de implementacion).
  async release(vehicleId: string): Promise<void> {
    const slotId = await this.calendarPort.findActiveSlotId('vehicle', vehicleId);
    if (!slotId) {
      return;
    }
    await this.calendarPort.release(slotId);
  }

  // reschedule()/approveExtension() mueven la ventana ocupada del MISMO vehicleId (a
  // diferencia de swapVehicle, que ocupa un vehicleId distinto) - occupy-antes-que-release
  // (Hallazgo #2) crearia momentaneamente DOS AvailabilitySlot Active para el mismo
  // resourceId, lo que vuelve ambiguo a `release(vehicleId)` (busca "el" slot activo). Se
  // captura el id del slot viejo ANTES de ocupar el nuevo, cuando la busqueda todavia es
  // inequivoca, y se libera por id explicito despues.
  async moveOccupancy(
    companyId: string,
    vehicleId: string,
    newRange: DateRange,
    reservationId: string,
  ): Promise<void> {
    const oldSlotId = await this.calendarPort.findActiveSlotId('vehicle', vehicleId);
    await this.reserve(companyId, vehicleId, newRange, reservationId);
    if (oldSlotId) {
      await this.calendarPort.release(oldSlotId);
    }
  }
}
