// Tipos de la web de administracion, modulo Reservas (docs/persistence/10-DECISIONES.md #135).
// Escritos a mano y verificados contra el backend, mismo criterio que el resto de este paquete:
//   - libs/products/rental/reservations/application/src/queries/get-reservation-detail/
//     get-reservation-detail.query.ts (ReservationListItem, ReservationDetail);
//   - libs/products/rental/customers/application/src/queries/get-customer/get-customer.query.ts;
//   - libs/platform/branches/application/src/queries/get-branch/get-branch.query.ts;
//   - libs/products/rental/invoices/application/src/queries/get-invoice/get-invoice.query.ts;
//   - los DTOs de request de libs/products/rental/reservations/infrastructure/src/http/dto/.
import type { ReservationSummary } from './reservation.types';

// prisma/schema/rental.prisma, enum ReservationStatus.
export type ReservationStatus =
  'Draft' | 'Confirmed' | 'CheckedOut' | 'CheckedIn' | 'Closed' | 'Cancelled';

export interface ReservationCustomerRef {
  id: string;
  name: string;
}

export interface ReservationVehicleRef {
  id: string;
  licensePlate: string;
  branchId: string;
}

// GET /reservations?expand=customer,vehicle - customer/vehicle solo si se pidieron.
export interface ReservationListItem extends ReservationSummary {
  customer?: ReservationCustomerRef;
  vehicle?: ReservationVehicleRef;
}

export interface ReservationInspection {
  id: string;
  type: 'CheckOut' | 'CheckIn';
  odometer: number;
  fuelLevel: number;
  inspectedAt: string;
  inspectedBy: string;
}

export interface ReservationDamageReport {
  id: string;
  inspectionId: string;
  description: string;
  severity: 'Minor' | 'Severe';
  imputableToCustomer: boolean;
  createdAt: string;
}

// prisma/schema/rental.prisma, enum PriceAdjustmentKind.
export type PriceAdjustmentKind =
  'Extension' | 'LateReturnPenalty' | 'DamagePenalty' | 'FuelDifference' | 'CancellationPenalty';

export interface ReservationPriceAdjustment {
  id: string;
  kind: PriceAdjustmentKind;
  amountMinorUnits: number;
  currency: string;
  reason?: string;
  createdAt: string;
}

// GET /reservations/:id (solo personal).
export interface ReservationDetail extends ReservationListItem {
  inspections: ReservationInspection[];
  damageReports: ReservationDamageReport[];
  priceAdjustments: ReservationPriceAdjustment[];
}

// POST /reservations (staff): devuelve { id }.
export interface CreateReservationRequest {
  customerId: string;
  vehicleId: string;
  startDate: string;
  endDate: string;
  authorizedDriverIds?: string[];
}

export interface RescheduleReservationRequest {
  newStartDate: string;
  newEndDate: string;
}

export interface RequestExtensionRequest {
  requestedNewEndDate: string;
}

export interface ApproveExtensionRequest {
  newEndDate: string;
}

export interface SwapVehicleRequest {
  newVehicleId: string;
  reason?: string;
}

// GET /customers (q, cursor).
export interface CustomerListItem {
  id: string;
  name: string;
  taxIdOrDocumentId: string;
  customerType: string;
  status: 'Registered' | 'Active';
  blockStatus: 'None' | 'Blocked';
}

// GET /branches.
export interface BranchSummary {
  id: string;
  name: string;
  address: {
    line1: string;
    line2?: string;
    city: string;
    stateProvince?: string;
    postalCode?: string;
    country: string;
  };
  operatingHours: { day: string; open: string; close: string }[];
  timeZone: string;
  status: 'Active' | 'Closed';
}

// GET /invoices?reservationId=.
export interface InvoiceCharge {
  id: string;
  kind: string;
  amountMinorUnits: number;
  currency: string;
  description: string;
}

export interface InvoiceSummary {
  id: string;
  reservationId: string;
  customerId: string;
  invoiceNumber: string;
  status: 'Issued' | 'Voided';
  taxAmountMinorUnits: number;
  totalMinorUnits: number;
  currency: string;
  voidReason?: string;
  charges: InvoiceCharge[];
}
