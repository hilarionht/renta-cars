export class CompanyResponseDto {
  id!: string;
  legalName!: string;
  taxId!: string;
  billingContactEmail!: string;
  billingContactPhone?: string;
  status!: string;
}
