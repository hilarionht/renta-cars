// Puerto publico consumido por apps/api (CompanyStatusGuard, docs/technical/
// 03-BACKEND-ARCHITECTURE.md SS7) - superficie minima de solo lectura, nunca expone
// CompanyRepository completo cross-modulo (docs/05-CONVENCIONES-BACKEND.md SS3).
export const COMPANY_LOOKUP_PORT = Symbol('CompanyLookupPort');

export interface CompanyLookupPort {
  getStatus(companyId: string): Promise<'Active' | 'Suspended' | null>;
}
