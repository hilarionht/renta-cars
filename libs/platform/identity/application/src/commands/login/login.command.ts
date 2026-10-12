export interface LoginCommand {
  companyId: string;
  email: string;
  password: string;
  userAgent?: string;
  ipAddress?: string;
}

// MFA TOTP (docs/persistence/10-DECISIONES.md #111) - union discriminada: password correcta
// no basta cuando el User tiene MFA habilitado, el caller (AuthController) debe ramificar
// antes de emitir tokens.
export type LoginResult =
  | { status: 'authenticated'; accessToken: string; refreshToken: string; sessionId: string }
  | { status: 'mfa_required'; mfaChallengeId: string };
