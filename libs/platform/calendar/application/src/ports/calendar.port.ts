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
  // Agregado para AvailabilityService.release() (docs/persistence/10-DECISIONES.md #59) -
  // Reservation no contiene el AvailabilitySlot ("no se persiste ni cachea", docs/model/
  // 02-AGGREGATES.md SS11), asi que necesita resolver el slotId activo antes de poder
  // llamar release(slotId). null = no hay slot Active para ese recurso.
  findActiveSlotId(resourceType: string, resourceId: string): Promise<string | null>;
  // docs/persistence/10-DECISIONES.md #116: version batch de isAvailable - de una lista de
  // candidatos, cuales tienen un AvailabilitySlot Active solapando el rango. Consumidor nuevo
  // y paralelo a AvailabilityService (reservations/application), no la misma ACL - ver #116.
  findOccupiedResourceIds(
    resourceType: string,
    resourceIds: string[],
    startDate: Date,
    endDate: Date,
  ): Promise<string[]>;
}
