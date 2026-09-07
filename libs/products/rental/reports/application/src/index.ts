// Superficie publica de "rental-reports-application".
// Exporta explicitamente cada simbolo - prohibido `export *`. Ver docs/technical/
// 09-CODING-STANDARDS.md SS2.
export type {
  RevenueByBranchQuery,
  RevenueByBranchItem,
  RevenueByBranchResult,
} from './queries/revenue-by-branch/revenue-by-branch.query';
export type {
  FleetUtilizationQuery,
  FleetUtilizationItem,
  FleetUtilizationResult,
} from './queries/fleet-utilization/fleet-utilization.query';
export type {
  ReservationFunnelQuery,
  ReservationFunnelItem,
  ReservationFunnelResult,
} from './queries/reservation-funnel/reservation-funnel.query';
export type {
  CustomerActivityQuery,
  CustomerActivitySpend,
  CustomerActivityItem,
  CustomerActivityResult,
} from './queries/customer-activity/customer-activity.query';

export { InvalidReportRangeError } from './errors/invalid-report-range.error';
