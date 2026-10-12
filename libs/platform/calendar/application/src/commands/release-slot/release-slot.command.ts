// Sin companyId - a diferencia de los comandos de Customers/Vehicles (siempre invocados
// desde un controller HTTP con RequestContext ya poblado), este comando solo se invoca via
// CALENDAR_PORT (DI cross-modulo, sin controller propio para mutaciones - docs/contracts/
// 02-RESOURCE-CATALOG.md SS3). La pertenencia al tenant la garantiza RLS de forma ambiente
// (el llamador ya corre dentro de una transaccion con el contexto de company ya fijado),
// mismo criterio que VEHICLE_STATUS_PORT/CUSTOMER_LOOKUP_PORT (solo reciben el id).
export interface ReleaseSlotCommand {
  slotId: string;
}
