// Tipos de la web de administracion, modulo Clientes (docs/persistence/10-DECISIONES.md #139).
// Escritos a mano y verificados contra el backend:
//   - libs/products/rental/customers/application/src/queries/get-customer/get-customer.query.ts;
//   - libs/products/rental/customers/infrastructure/src/http/dto/*.ts (requests);
//   - prisma/schema/rental.prisma (enums).
// El listado (GET /customers) usa CustomerListItem, de staff-reservation.types.ts (#135).

export type CustomerType = 'Individual' | 'Corporate';
export type CustomerStatus = 'Registered' | 'Active';
export type CustomerBlockStatus = 'None' | 'Blocked';

// upload-identity-document-request.dto.ts (DOCUMENT_TYPES).
export type IdentityDocumentType = 'NationalId' | 'DriversLicense';

// Replaced (#139): reemplazado por una renovacion; queda como historial.
export type DocumentStatus = 'Pending' | 'Verified' | 'Expired' | 'Replaced';

export interface IdentityDocument {
  id: string;
  ownerType: 'Customer' | 'AdditionalDriver';
  ownerId: string;
  documentType: IdentityDocumentType;
  fileId: string;
  expiryDate: string;
  status: DocumentStatus;
  extractedByOcr: boolean;
}

export type AdditionalDriverStatus = 'Registered' | 'Validated' | 'Revoked';

export interface AdditionalDriver {
  id: string;
  name: string;
  status: AdditionalDriverStatus;
}

// GET /customers/:id. Los documentos vienen en orden de carga (historial de renovaciones).
export interface CustomerDetail {
  id: string;
  companyId: string;
  name: string;
  taxIdOrDocumentId: string;
  contactEmail: string;
  contactPhone: string;
  customerType: CustomerType;
  status: CustomerStatus;
  blockStatus: CustomerBlockStatus;
  blockReason?: string;
  identityDocuments: IdentityDocument[];
  additionalDrivers: AdditionalDriver[];
}

export interface RegisterCustomerRequest {
  name: string;
  taxIdOrDocumentId: string;
  contactEmail: string;
  contactPhone: string;
  customerType: CustomerType;
}

export interface UpdateCustomerRequest {
  name?: string;
  contactEmail?: string;
  contactPhone?: string;
}

export interface BlockCustomerRequest {
  reason: string;
}

export interface UploadIdentityDocumentRequest {
  documentType: IdentityDocumentType;
  fileId: string;
  expiryDate: string;
  additionalDriverId?: string;
}

export interface RegisterAdditionalDriverRequest {
  name: string;
}
