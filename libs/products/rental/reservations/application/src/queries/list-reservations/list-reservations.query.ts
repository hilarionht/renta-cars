import type { ReservationListItem } from '../get-reservation-detail/get-reservation-detail.query';

export interface ListReservationsQuery {
  companyId: string;
  customerId?: string;
  vehicleId?: string;
  status?: string;
  // Ya resuelto por el controller: el del token si lo trae, si no el del query
  // (excepcion acotada a docs/contracts/01-REST-STANDARDS.md SS7, docs/persistence/
  // 10-DECISIONES.md #135).
  branchId?: string;
  expand?: string[];
  cursor?: string;
  limit?: number;
}

export interface ListReservationsResult {
  items: ReservationListItem[];
  // Cursor opaco del siguiente elemento, null si es la ultima pagina (docs/persistence/
  // 10-DECISIONES.md #112).
  nextCursor: string | null;
  // Limit EFECTIVO ya aplicado (default 25 si el caller no paso ninguno) - unica fuente de
  // verdad, el controller solo lo lee para armar meta.limit, sin duplicar el default.
  limit: number;
}
