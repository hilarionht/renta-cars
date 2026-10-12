export interface GetReservationQuery {
  companyId: string;
  reservationId: string;
}

export interface ReservationSummary {
  id: string;
  customerId: string;
  vehicleId: string;
  status: string;
  startDate: string;
  endDate: string;
  baseAmountMinorUnits: number;
  currency: string;
  authorizedDriverIds: string[];
}
