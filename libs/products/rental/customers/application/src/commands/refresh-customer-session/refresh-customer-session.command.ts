export interface RefreshCustomerSessionCommand {
  refreshToken: string;
  userAgent?: string;
  ipAddress?: string;
}

export interface RefreshCustomerSessionResult {
  accessToken: string;
  refreshToken: string;
  customerSessionId: string;
}
