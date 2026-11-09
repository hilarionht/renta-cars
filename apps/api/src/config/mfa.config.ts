import { registerAs } from '@nestjs/config';

// Namespace "mfa" - docs/persistence/10-DECISIONES.md #111 y #158. MFA es opt-in por User, pero
// la clave es obligatoria al boot: env.validation.ts la exige con el mismo formato que valida
// Aes256GcmMfaSecretCipher, que se construye siempre. Generar con: openssl rand -hex 32.
export default registerAs('mfa', () => ({
  secretEncryptionKey: process.env.MFA_SECRET_ENCRYPTION_KEY ?? '',
}));
