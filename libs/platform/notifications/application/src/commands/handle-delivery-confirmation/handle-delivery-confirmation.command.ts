export interface HandleDeliveryConfirmationCommand {
  notificationId: string;
  companyId: string;
  outcome: 'delivered' | 'failed';
  reason?: string;
}
