export interface UpdateCustomerDetailsCommand {
  customerId: string;
  companyId: string;
  name?: string;
  contactEmail?: string;
  contactPhone?: string;
}
