export interface ReservationFunnelQuery {
  companyId: string;
  from: string;
  to: string;
}

export interface ReservationFunnelItem {
  status: string;
  count: number;
}

export interface ReservationFunnelResult {
  items: ReservationFunnelItem[];
}
