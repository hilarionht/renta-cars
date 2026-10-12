import type { UserSummary } from '../get-user/get-user.query';

// docs/persistence/10-DECISIONES.md #134: perfil + permisos efectivos del User autenticado.
// roles viene del access token (RequestContext), igual que PermissionGuard - la web muestra
// exactamente lo que el API va a permitir, no una version "mas fresca" que la del token.
export interface GetCurrentUserQuery {
  userId: string;
  companyId: string;
  roles: readonly string[];
}

export interface CurrentUserProfile extends UserSummary {
  companyId: string;
  permissions: string[];
}
