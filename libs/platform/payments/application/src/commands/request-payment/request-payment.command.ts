export interface RequestPaymentCommand {
  companyId: string;
  targetType: 'Invoice' | 'SecurityDeposit';
  targetId: string;
  amountMinorUnits: number;
  currency: string;
  method: string;
  idempotencyKey: string;
}
