export interface RegisterCustomerCommand {
  companyId: string;
  name: string;
  taxIdOrDocumentId: string;
  contactEmail: string;
  contactPhone: string;
  customerType: string;
}
