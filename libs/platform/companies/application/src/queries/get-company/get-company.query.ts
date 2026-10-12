export interface GetCompanyQuery {
  companyId: string;
}

export interface CompanySummary {
  id: string;
  legalName: string;
  taxId: string;
  billingContactEmail: string;
  billingContactPhone?: string;
  status: string;
}
