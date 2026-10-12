// Valor de configuracion inyectado (no un puerto a un sistema externo), mismo mecanismo de
// token que el resto de application/ - mantiene a ConfirmUploadHandler desacoplado de
// @nestjs/config y de apps/api/src/config/storage.config.ts (libs/ no puede importar apps/,
// tooling/eslint/boundaries.mjs). FilesModule (infrastructure) bindea este token via un
// factory que lee ConfigService.
export const STORAGE_LIMITS = Symbol('StorageLimits');

export interface StorageLimits {
  maxUploadBytes: number;
}
