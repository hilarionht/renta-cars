import type { SecurityDepositSummary } from '../get-security-deposit/get-security-deposit.query';

export interface ListSecurityDepositsQuery {
  companyId: string;
  reservationId?: string;
}

export interface ListSecurityDepositsResult {
  items: SecurityDepositSummary[];
}
