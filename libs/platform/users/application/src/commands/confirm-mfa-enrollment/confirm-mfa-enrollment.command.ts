export interface ConfirmMfaEnrollmentCommand {
  userId: string;
  companyId: string;
  secret: string;
  code: string;
}
