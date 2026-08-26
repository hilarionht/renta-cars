// Puerto publico consumido por platform-identity (Login necesita verificar credenciales de
// un User que pertenece a este modulo, nunca importando UserRepository completo
// cross-modulo - docs/05-CONVENCIONES-BACKEND.md SS3).
export const USER_LOOKUP_PORT = Symbol('UserLookupPort');

export interface UserLookupResult {
  userId: string;
  companyId: string;
  branchId?: string;
  passwordHash: string;
  status: string;
  roles: string[];
  mfaEnabled: boolean;
  mfaSecretEncrypted?: string;
}

export interface UserLookupPort {
  findByCompanyAndEmail(companyId: string, email: string): Promise<UserLookupResult | null>;
  // Usado por RefreshSession (platform-identity) para re-armar los claims del access_token
  // nuevo sin volver a pedir email/password - Session solo guarda userId/companyId. companyId
  // lo pasa el caller (ya lo conoce via la Session encontrada por hash) - RLS de users exige
  // company_id = tenant actual, y en este punto no hay RequestContext poblado (@Public()).
  findById(userId: string, companyId: string): Promise<UserLookupResult | null>;
}
