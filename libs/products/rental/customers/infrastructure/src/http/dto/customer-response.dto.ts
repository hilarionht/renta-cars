export class IdentityDocumentResponseDto {
  id!: string;
  ownerType!: 'Customer' | 'AdditionalDriver';
  ownerId!: string;
  documentType!: string;
  fileId!: string;
  expiryDate!: string;
  status!: string;
  extractedByOcr!: boolean;
}

export class AdditionalDriverResponseDto {
  id!: string;
  name!: string;
  status!: string;
}

export class CustomerResponseDto {
  id!: string;
  companyId!: string;
  name!: string;
  taxIdOrDocumentId!: string;
  contactEmail!: string;
  contactPhone!: string;
  customerType!: string;
  status!: string;
  blockStatus!: string;
  blockReason?: string;
  identityDocuments!: IdentityDocumentResponseDto[];
  additionalDrivers!: AdditionalDriverResponseDto[];
}
