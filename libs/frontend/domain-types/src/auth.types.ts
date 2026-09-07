// Verificado contra libs/platform/identity/infrastructure/src/http/{auth.controller.ts,
// dto/login-request.dto.ts,dto/refresh-request.dto.ts}. Mobile siempre manda
// X-Client-Platform: mobile (docs/08-API-CONTRACTS.md SS9.1) - la respuesta SIEMPRE trae
// refreshToken en el body (nunca cookie, a diferencia de web), asi que AuthResponse no
// necesita el union {accessToken} | {accessToken, refreshToken} que el backend soporta.
export interface LoginRequest {
  companyId: string;
  email: string;
  password: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
}
