// docs/model/02-AGGREGATES.md SS14 - catalogo cerrado de 5 valores, distinto del catalogo de
// PriceAdjustmentKind de Reservation (Extension/LateReturnPenalty/DamagePenalty/
// FuelDifference/CancellationPenalty) - la traduccion ACL vive en invoices/infrastructure
// (el Listener que reacciona a ReservationCheckedIn.v1), nunca en este VO.
export const CHARGE_KINDS = ['RentalFee', 'Extension', 'Penalty', 'Damage', 'Fuel'] as const;

export type ChargeKindValue = (typeof CHARGE_KINDS)[number];
