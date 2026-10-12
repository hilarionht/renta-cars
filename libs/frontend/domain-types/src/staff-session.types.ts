// Web de administracion (docs/persistence/10-DECISIONES.md #134). Verificado contra
// auth.controller.ts (respondWithTokens: sin X-Client-Platform el refresh viaja en cookie
// httpOnly y el body trae solo accessToken) y users.controller.ts (GET /users/me).
export interface WebAuthResponse {
  accessToken: string;
}

export interface MfaRequiredResponse {
  mfaRequired: true;
  mfaChallengeId: string;
}

export type WebLoginResponse = WebAuthResponse | MfaRequiredResponse;

export interface CurrentUser {
  id: string;
  email: string;
  name: string;
  status: string;
  roles: string[];
  branchId?: string;
  companyId: string;
  permissions: string[];
}
