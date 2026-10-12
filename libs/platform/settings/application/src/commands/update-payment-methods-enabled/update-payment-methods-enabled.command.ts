export interface UpdatePaymentMethodsEnabledCommand {
  companyId: string;
  paymentMethods: string[];
}
