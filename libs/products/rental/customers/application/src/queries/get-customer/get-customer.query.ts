export interface GetCustomerQuery {
  customerId: string;
  companyId: string;
}

export interface IdentityDocumentSummary {
  id: string;
  ownerType: 'Customer' | 'AdditionalDriver';
  ownerId: string;
  documentType: string;
  fileId: string;
  expiryDate: string;
  status: string;
}

export interface AdditionalDriverSummary {
  id: string;
  name: string;
  status: string;
}

export interface CustomerDetail {
  id: string;
  companyId: string;
  name: string;
  taxIdOrDocumentId: string;
  contactEmail: string;
  contactPhone: string;
  customerType: string;
  status: string;
  blockStatus: string;
  blockReason?: string;
  identityDocuments: IdentityDocumentSummary[];
  additionalDrivers: AdditionalDriverSummary[];
}

export interface ListCustomersQuery {
  companyId: string;
}

export interface CustomerSummary {
  id: string;
  name: string;
  taxIdOrDocumentId: string;
  customerType: string;
  status: string;
  blockStatus: string;
}
