export interface RegisterCompanyCommand {
  legalName: string;
  taxId: string;
  billingContactEmail: string;
  billingContactPhone?: string;
}
