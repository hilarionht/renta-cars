export interface RefreshSessionCommand {
  refreshToken: string;
  userAgent?: string;
  ipAddress?: string;
}

export interface RefreshSessionResult {
  accessToken: string;
  refreshToken: string;
  sessionId: string;
}
