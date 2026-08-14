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
}

export interface UserLookupPort {
  findByCompanyAndEmail(companyId: string, email: string): Promise<UserLookupResult | null>;
  // Usado por RefreshSession (platform-identity) para re-armar los claims del access_token
  // nuevo sin volver a pedir email/password - Session solo guarda userId/companyId.
  findById(userId: string): Promise<UserLookupResult | null>;
}
