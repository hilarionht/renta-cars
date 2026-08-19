export interface GetCompanySettingsQuery {
  companyId: string;
}

export interface CompanySettingsSummary {
  companyId: string;
  enabledProductModules: string[];
  paymentMethodsEnabled: string[];
  cancellationPolicyTiers: { minHoursBeforeStart: number; penaltyPercentage: number }[];
  lateReturnGraceMinutes: number;
  lateReturnPenaltyPercentagePerHour: number;
  depositApplies: boolean;
  depositPercentageOfTotal: number;
  draftExpirationMinutes: number;
  minimumBookingLeadTimeMinutes: number;
}
