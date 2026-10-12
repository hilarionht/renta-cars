export interface VerifyCustomerOtpCommand {
  companyId: string;
  phone: string;
  code: string;
  userAgent?: string;
  ipAddress?: string;
}

export interface VerifyCustomerOtpResult {
  accessToken: string;
  refreshToken: string;
  customerSessionId: string;
}
