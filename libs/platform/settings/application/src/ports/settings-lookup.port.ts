// Puerto publico consumido por apps/api (TenantModuleEnabledGuard, docs/technical/
// 03-BACKEND-ARCHITECTURE.md SS7) - superficie minima de solo lectura, nunca expone
// SettingsRepository completo cross-modulo (docs/05-CONVENCIONES-BACKEND.md SS3).
export const SETTINGS_LOOKUP_PORT = Symbol('SettingsLookupPort');

export interface SettingsLookupPort {
  getEnabledProductModules(companyId: string): Promise<string[] | null>;
}
