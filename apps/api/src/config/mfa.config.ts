import { registerAs } from '@nestjs/config';

// Namespace "mfa" - docs/persistence/10-DECISIONES.md #111. A diferencia de JWT (obligatoria,
// auth de TODO request) MFA es opt-in por User - no se exige al boot vía env.validation.ts
// (mismo criterio que las credenciales de payments/notifications, @IsOptional). Aes256GcmMfaSecretCipher
// (infrastructure/providers) es quien realmente falla rápido si la clave falta/es inválida,
// en su propio constructor - como UsersModule siempre se compone en apps/api, esto es
// fail-fast en la práctica sin forzar el schema global. Generar con: openssl rand -hex 32.
export default registerAs('mfa', () => ({
  secretEncryptionKey: process.env.MFA_SECRET_ENCRYPTION_KEY ?? '',
}));
