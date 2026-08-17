export interface GetCompanySettingsQuery {
  companyId: string;
}

export interface CompanySettingsSummary {
  companyId: string;
  enabledProductModules: string[];
  paymentMethodsEnabled: string[];
}
