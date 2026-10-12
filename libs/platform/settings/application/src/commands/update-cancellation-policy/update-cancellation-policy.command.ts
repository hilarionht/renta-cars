export interface UpdateCancellationPolicyCommand {
  companyId: string;
  tiers: { minHoursBeforeStart: number; penaltyPercentage: number }[];
}
