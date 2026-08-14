// Puerto publico consumido por otros modulos (hoy: users, para validar un roleId al
// asignarlo) - superficie minima, nunca expone el RoleRepository completo cross-modulo
// (docs/05-CONVENCIONES-BACKEND.md SS3: application/ solo importa el index.ts publico de
// otro modulo).
export const ROLE_LOOKUP_PORT = Symbol('RoleLookupPort');

export interface RoleLookupPort {
  existsAndBelongsToCompanyOrSystem(roleId: string, companyId: string): Promise<boolean>;
}
