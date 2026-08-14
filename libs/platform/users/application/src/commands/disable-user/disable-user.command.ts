export interface DisableUserCommand {
  userId: string;
  companyId: string;
  disabledBy: string;
  reason?: string;
}
