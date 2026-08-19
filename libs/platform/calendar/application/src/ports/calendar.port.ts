import type { SlotKindValue } from '@platform/calendar/domain';

// Puerto publico forward-looking - AvailabilityService (docs/model/05-DOMAIN_SERVICES.md
// SS1), la Anti-Corruption Layer formal entre Rental Operations y Scheduling, lo consumira
// cuando el futuro modulo reservations exista. Metodos inferidos de esa descripcion:
// isAvailable/occupy/release. Sin consumidor real todavia - mismo tratamiento que
// CUSTOMER_LOOKUP_PORT/VEHICLE_STATUS_PORT.
export const CALENDAR_PORT = Symbol('CalendarPort');

export interface OccupySlotParams {
  companyId: string;
  resourceType: string;
  resourceId: string;
  startDate: Date;
  endDate: Date;
  slotKind: SlotKindValue;
}

export interface CalendarPort {
  isAvailable(
    resourceType: string,
    resourceId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<boolean>;
  // Retorna el id del AvailabilitySlot creado. Lanza AvailabilitySlotOverlapError (via el
  // command handler subyacente) si el rango se solapa con un slot Active existente.
  occupy(params: OccupySlotParams): Promise<string>;
  release(slotId: string): Promise<void>;
}
