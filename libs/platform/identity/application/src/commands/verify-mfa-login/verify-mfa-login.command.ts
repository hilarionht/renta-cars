export interface VerifyMfaLoginCommand {
  mfaChallengeId: string;
  companyId: string;
  code: string;
}

export interface VerifyMfaLoginResult {
  accessToken: string;
  refreshToken: string;
  sessionId: string;
}
