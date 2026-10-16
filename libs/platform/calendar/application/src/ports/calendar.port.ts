import type { UnitOfWorkTransaction } from '@platform/shared-kernel';
import type { SlotKindValue } from '@platform/calendar/domain';

// Puerto publico forward-looking - AvailabilityService (docs/model/05-DOMAIN_SERVICES.md
// SS1), la Anti-Corruption Layer formal entre Rental Operations y Scheduling, lo consumira
// cuando el futuro modulo reservations exista. Metodos inferidos de esa descripcion:
// isAvailable/occupy/release. Sin consumidor real todavia - mismo tratamiento que
// CUSTOMER_LOOKUP_PORT/VEHICLE_STATUS_PORT.
export const CALENDAR_PORT = Symbol('CalendarPort');

// docs/persistence/10-DECISIONES.md #137: una ocupacion Booking activa de un recurso.
export interface ActiveBooking {
  referenceId: string;
  startDate: Date;
  endDate: Date;
}

export interface OccupySlotParams {
  companyId: string;
  resourceType: string;
  resourceId: string;
  startDate: Date;
  endDate: Date;
  slotKind: SlotKindValue;
}

// docs/persistence/10-DECISIONES.md #141: las escrituras y las lecturas que pueden ir dentro de
// otra transaccion reciben `tx` opcional. Con `tx`, el calendario lee y escribe en la transaccion
// del que llama (una reserva y su ocupacion se confirman o revierten juntas); sin `tx`, abre la
// suya como antes.
export interface CalendarPort {
  isAvailable(
    resourceType: string,
    resourceId: string,
    startDate: Date,
    endDate: Date,
    // docs/persistence/10-DECISIONES.md #136: ignora los slots de esta referencia.
    excludeReferenceId?: string,
  ): Promise<boolean>;
  // Retorna el id del AvailabilitySlot creado. Lanza AvailabilitySlotOverlapError (via el
  // command handler subyacente) si el rango se solapa con un slot Active existente.
  occupy(params: OccupySlotParams, tx?: UnitOfWorkTransaction): Promise<string>;
  release(slotId: string, tx?: UnitOfWorkTransaction): Promise<void>;
  // docs/persistence/10-DECISIONES.md #136: libera el slot y ocupa uno nuevo con otro rango,
  // atomico. Devuelve el id del nuevo. Lanza AvailabilitySlotOverlapError si el rango nuevo
  // choca con OTRO slot (el viejo queda Active).
  move(slotId: string, startDate: Date, endDate: Date, tx?: UnitOfWorkTransaction): Promise<string>;
  // Agregado para AvailabilityService.release() (docs/persistence/10-DECISIONES.md #59) -
  // Reservation no contiene el AvailabilitySlot ("no se persiste ni cachea", docs/model/
  // 02-AGGREGATES.md SS11), asi que necesita resolver el slotId activo antes de poder
  // llamar release(slotId). null = no hay slot Active para ese recurso y referencia.
  // referenceId OBLIGATORIO (docs/persistence/10-DECISIONES.md #132): un recurso tiene un slot
  // Active por cada reserva futura, asi que buscar "el" slot activo solo por recurso devolvia
  // uno cualquiera y release() liberaba la ocupacion de OTRA reserva (doble reserva posible).
  findActiveSlotId(
    resourceType: string,
    resourceId: string,
    referenceId: string,
    tx?: UnitOfWorkTransaction,
  ): Promise<string | null>;
  // docs/persistence/10-DECISIONES.md #137: ocupaciones Booking Active de un recurso (los Blackout
  // no cuentan), ordenadas por inicio. Las usa vehicles para no dejar sin auto a una reserva al
  // programar mantenimiento, reportar un dano o marcar fuera de servicio. companyId explicito
  // (no del RequestContext) para no repetir el gap de #132.
  findActiveBookings(
    companyId: string,
    resourceType: string,
    resourceId: string,
    tx?: UnitOfWorkTransaction,
  ): Promise<ActiveBooking[]>;
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
