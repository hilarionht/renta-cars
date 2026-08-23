// Puerto publico consumido por Reservation via CustomerLookupPort para INV-104
// ("Reservation.confirm() consulta CustomerLookupPort antes de transicionar", docs/model/
// 07-INVARIANTS.md). Superficie minima de solo lectura, mismo patron que
// COMPANY_LOOKUP_PORT/SETTINGS_LOOKUP_PORT - nunca expone CustomerRepository completo
// cross-modulo. areAdditionalDriversValidated agregado (docs/persistence/
// 10-DECISIONES.md #59) - INV-105, Reservation.checkOut() valida que cada driverId
// autorizado referencia un AdditionalDriver en estado Validated.
export const CUSTOMER_LOOKUP_PORT = Symbol('CustomerLookupPort');

export interface CustomerContactInfo {
  email: string;
  phone: string;
  name: string;
}

export interface CustomerLookupPort {
  // null = el customer no existe.
  isEligibleForConfirmation(customerId: string): Promise<boolean | null>;
  // true si driverIds es vacio o si todos los AdditionalDriver referenciados existen y
  // estan Validated; false en cualquier otro caso (incluido un driverId inexistente).
  areAdditionalDriversValidated(driverIds: string[]): Promise<boolean>;
  // Agregado para Fase 3 item 3 (Notifications) - a diferencia de los 2 metodos de arriba,
  // companyId es opcional explicito: los nuevos callers (ReservationConfirmedNotification
  // Listener/InvoiceIssuedNotificationListener) son listeners fire-and-forget, sin garantia
  // de propagacion de RequestContext (CLS) a traves de la continuacion async detached -
  // mismo mecanismo ya documentado en SecurityDepositRepository.findById(id, companyId?).
  // null = el customer no existe.
  getContactInfo(customerId: string, companyId?: string): Promise<CustomerContactInfo | null>;
}
