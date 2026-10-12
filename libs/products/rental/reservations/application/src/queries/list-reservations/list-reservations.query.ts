import type { ReservationSummary } from '../get-reservation/get-reservation.query';

export interface ListReservationsQuery {
  companyId: string;
  customerId?: string;
  vehicleId?: string;
  status?: string;
  cursor?: string;
  limit?: number;
}

export interface ListReservationsResult {
  items: ReservationSummary[];
  // Cursor opaco del siguiente elemento, null si es la ultima pagina (docs/persistence/
  // 10-DECISIONES.md #112).
  nextCursor: string | null;
  // Limit EFECTIVO ya aplicado (default 25 si el caller no paso ninguno) - unica fuente de
  // verdad, el controller solo lo lee para armar meta.limit, sin duplicar el default.
  limit: number;
}
