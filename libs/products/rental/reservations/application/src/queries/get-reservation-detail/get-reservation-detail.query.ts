import type { ReservationSummary } from '../get-reservation/get-reservation.query';

// docs/persistence/10-DECISIONES.md #135: valores de `?expand=` en GET /reservations y
// GET /reservations/:id (solo personal). Cada uno agrega un objeto minimo, nunca el recurso
// completo.
export const RESERVATION_EXPAND_VALUES = ['customer', 'vehicle'] as const;
export type ReservationExpandValue = (typeof RESERVATION_EXPAND_VALUES)[number];

export interface ReservationExpansions {
  customer?: { id: string; name: string };
  vehicle?: { id: string; licensePlate: string; branchId: string };
}

export type ReservationListItem = ReservationSummary & ReservationExpansions;

export interface GetReservationDetailQuery {
  companyId: string;
  reservationId: string;
  expand?: string[];
}

export interface ReservationInspectionView {
  id: string;
  type: string;
  odometer: number;
  fuelLevel: number;
  inspectedAt: string;
  inspectedBy: string;
}

export interface ReservationDamageReportView {
  id: string;
  inspectionId: string;
  description: string;
  severity: string;
  imputableToCustomer: boolean;
  createdAt: string;
}

export interface ReservationPriceAdjustmentView {
  id: string;
  kind: string;
  amountMinorUnits: number;
  currency: string;
  reason?: string;
  createdAt: string;
}

// Detalle para el personal (GET /reservations/:id). /me/reservations/:id sigue devolviendo
// ReservationSummary: las inspecciones y los daños no se exponen al cliente.
export interface ReservationDetail extends ReservationListItem {
  inspections: ReservationInspectionView[];
  damageReports: ReservationDamageReportView[];
  priceAdjustments: ReservationPriceAdjustmentView[];
}
