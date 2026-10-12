export interface UpdateMaintenanceThresholdPolicyCommand {
  companyId: string;
  applies: boolean;
  odometerThresholdKm?: number;
  daysThreshold?: number;
}
