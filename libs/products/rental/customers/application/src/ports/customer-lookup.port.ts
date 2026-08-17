// Puerto publico forward-looking - Reservation (Fase 1, todavia no construido) lo consumira
// via CustomerLookupPort para exigir INV-104 ("Reservation.confirm() consulta
// CustomerLookupPort antes de transicionar", docs/model/07-INVARIANTS.md). Superficie
// minima de solo lectura, mismo patron que COMPANY_LOOKUP_PORT/SETTINGS_LOOKUP_PORT - nunca
// expone CustomerRepository completo cross-modulo.
export const CUSTOMER_LOOKUP_PORT = Symbol('CustomerLookupPort');

export interface CustomerLookupPort {
  // null = el customer no existe.
  isEligibleForConfirmation(customerId: string): Promise<boolean | null>;
}
