import type { ReservationSummary } from '../get-reservation/get-reservation.query';

export interface ListReservationsQuery {
  companyId: string;
  customerId?: string;
  vehicleId?: string;
  status?: string;
}

export interface ListReservationsResult {
  items: ReservationSummary[];
}
