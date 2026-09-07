// Fase 5 cliente-autogestion (docs/persistence/10-DECISIONES.md #109). generate() produce el
// codigo de 6 digitos en claro (el que se manda por WhatsApp, nunca persistido) + su hash SHA-
// 256 (lo unico que se guarda); hash() recalcula el hash de un codigo presentado por el
// cliente. Mismo shape que CustomerRefreshTokenHasher a proposito.
export const CUSTOMER_OTP_CODE_GENERATOR = Symbol('CustomerOtpCodeGenerator');

export interface CustomerOtpCodeGenerator {
  generate(): { code: string; hash: string };
  hash(code: string): string;
}
