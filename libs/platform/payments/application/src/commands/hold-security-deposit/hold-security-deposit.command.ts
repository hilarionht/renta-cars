export interface HoldSecurityDepositCommand {
  companyId: string;
  reservationId: string;
  amountMinorUnits: number;
  currency: string;
}
