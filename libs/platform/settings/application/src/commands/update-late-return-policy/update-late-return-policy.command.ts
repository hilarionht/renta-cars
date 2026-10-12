export interface UpdateLateReturnPolicyCommand {
  companyId: string;
  graceMinutes: number;
  penaltyPercentagePerHour: number;
}
