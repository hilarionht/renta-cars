export interface GetSecurityDepositQuery {
  companyId: string;
  securityDepositId: string;
}

export interface SecurityDepositSummary {
  id: string;
  reservationId: string;
  amountMinorUnits: number;
  currency: string;
  status: string;
  gatewayHoldReference?: string;
  retainedAmountMinorUnits?: number;
  retentionReason?: string;
}
