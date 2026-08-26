// MFA (TOTP) opt-in, docs/persistence/10-DECISIONES.md #111. RFC 6238 real (app
// autenticadora, secret compartido) - nunca un codigo enviado por ningun canal, a
// diferencia del OTP de clientes (WhatsApp). generateSecret() nunca persiste nada (el
// caller decide cuando/si el secret pasa a ser real, ver ConfirmMfaEnrollmentHandler) -
// domain/ no ve el secret en claro ni el algoritmo, esto vive en infrastructure/providers.
export const MFA_TOTP_PORT = Symbol('MfaTotpPort');

export interface MfaTotpPort {
  // accountLabel = email del User, usado en el otpauth:// URI para que la app autenticadora
  // muestre a que cuenta pertenece. Secret en Base32, formato estandar de authenticator apps.
  generateSecret(accountLabel: string): { secret: string; otpauthUrl: string };
  verifyCode(secret: string, code: string): Promise<boolean>;
}
