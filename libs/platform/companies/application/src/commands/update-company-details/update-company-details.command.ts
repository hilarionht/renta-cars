export interface UpdateCompanyDetailsCommand {
  companyId: string;
  legalName?: string;
  billingContactEmail?: string;
  billingContactPhone?: string;
}
