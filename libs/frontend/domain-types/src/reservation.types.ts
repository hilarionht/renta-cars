// Verificado contra libs/products/rental/reservations/application/src/queries/
// get-reservation/get-reservation.query.ts (ReservationSummary, tambien lo que devuelve
// GET /reservations, list-reservations.handler.ts) y prisma/schema/rental.prisma
// (ReservationStatus). Solo los 2 status que este flujo de operador necesita - el resto
// (Draft/CheckedIn/Closed/Cancelled) no son relevantes para check-out/check-in mobile.
export type ReservationStatusForOperator = 'Confirmed' | 'CheckedOut';

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

// libs/products/rental/reservations/infrastructure/src/http/dto/
// check-out-reservation-request.dto.ts, verificado directo.
export interface CheckOutReservationRequest {
  odometer: number;
  fuelLevelPercentage: number;
  photoFileIds: string[];
  inspectedBy: string;
}

// libs/products/rental/reservations/infrastructure/src/http/dto/
// check-in-reservation-request.dto.ts, verificado directo.
export type DamageSeverity = 'Minor' | 'Severe';

export interface CheckInDamage {
  description: string;
  severity: DamageSeverity;
  imputableToCustomer: boolean;
  photoFileIds: string[];
  penaltyAmountMinorUnits?: number;
}

export interface CheckInReservationRequest {
  odometer: number;
  fuelLevelPercentage: number;
  photoFileIds: string[];
  inspectedBy: string;
  damages?: CheckInDamage[];
}

// Verificado contra libs/products/rental/reservations/infrastructure/src/http/
// {dto/create-my-reservation-request.dto,me-reservations.controller}.ts - POST devuelve
// solo {id}, NUNCA ReservationSummary (a diferencia de POST /reservations de staff, que
// tampoco lo hace, pero se confirma aca porque es facil asumir lo contrario).
export interface CreateMyReservationRequest {
  vehicleId: string;
  startDate: string;
  endDate: string;
  authorizedDriverIds?: string[];
}

export interface CreateMyReservationResponse {
  id: string;
}
