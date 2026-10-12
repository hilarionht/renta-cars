export interface ChangePasswordCommand {
  userId: string;
  companyId: string;
  newPassword: string;
  changedBy: string;
}
