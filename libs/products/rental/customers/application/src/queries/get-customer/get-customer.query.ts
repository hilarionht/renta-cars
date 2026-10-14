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
  extractedByOcr: boolean;
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

// docs/persistence/10-DECISIONES.md #135: busqueda en el servidor (q, contrato
// docs/contracts/01-REST-STANDARDS.md) y paginacion por cursor (#112).
export interface ListCustomersQuery {
  companyId: string;
  q?: string;
  cursor?: string;
  limit?: number;
}

export interface ListCustomersResult {
  items: CustomerSummary[];
  nextCursor: string | null;
  limit: number;
}

export interface CustomerSummary {
  id: string;
  name: string;
  taxIdOrDocumentId: string;
  customerType: string;
  status: string;
  blockStatus: string;
}
