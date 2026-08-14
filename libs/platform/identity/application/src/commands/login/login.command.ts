export interface LoginCommand {
  companyId: string;
  email: string;
  password: string;
  userAgent?: string;
  ipAddress?: string;
}

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  sessionId: string;
}
