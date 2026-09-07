export interface RetainSecurityDepositCommand {
  companyId: string;
  securityDepositId: string;
  retainedAmountMinorUnits: number;
  currency: string;
  reason: string;
}
