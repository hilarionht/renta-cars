// MFA (TOTP) opt-in, docs/persistence/10-DECISIONES.md #111. A diferencia de PasswordHash
// (argon2id, un solo sentido - nunca hace falta recuperar la contrasena en claro), el
// secret TOTP debe poder DESCIFRARSE para calcular el codigo esperado en cada verificacion -
// por eso es cifrado reversible (AES-256-GCM), no un hash.
export const MFA_SECRET_CIPHER_PORT = Symbol('MfaSecretCipher');

export interface MfaSecretCipher {
  encrypt(plaintext: string): string;
  decrypt(ciphertext: string): string;
}
