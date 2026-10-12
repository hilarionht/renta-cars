import { registerAs } from '@nestjs/config';

// Namespace "jwt" - docs/engineering/07-CONFIGURATION.md SS1. Claves generadas con
// tooling/scripts/security/generate-jwt-keys.ts (paso 9 de
// docs/engineering/10-BOOTSTRAP-PLAN.md). Los valores en .env llevan "\n" literal (no
// newline real, formato mas simple de pegar en una sola linea) - se des-escapan aqui.
export default registerAs('jwt', () => ({
  privateKey: (process.env.JWT_PRIVATE_KEY ?? '').replace(/\\n/g, '\n'),
  publicKey: (process.env.JWT_PUBLIC_KEY ?? '').replace(/\\n/g, '\n'),
  activeKid: process.env.JWT_ACTIVE_KID,
  accessTtlSeconds: parseInt(process.env.JWT_ACCESS_TTL ?? '900', 10),
  // ADR-0008: "7-30 dias segun politica de producto" - 30 dias es un default de politica,
  // no un valor final calibrado contra uso real.
  refreshTtlSeconds: parseInt(process.env.JWT_REFRESH_TTL ?? '2592000', 10),
}));
