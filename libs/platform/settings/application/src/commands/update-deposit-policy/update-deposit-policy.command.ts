export interface UpdateDepositPolicyCommand {
  companyId: string;
  applies: boolean;
  percentageOfTotal: number;
}
