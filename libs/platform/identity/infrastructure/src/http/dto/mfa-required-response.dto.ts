// Rama LoginResult.status === 'mfa_required' - el cliente debe llamar POST /auth/mfa/verify
// con este mfaChallengeId antes de recibir tokens (MFA TOTP, docs/persistence/
// 10-DECISIONES.md #111).
export class MfaRequiredResponseDto {
  mfaRequired!: true;
  mfaChallengeId!: string;
}
