// Espejo de platform/identity/infrastructure/src/http/client-platform.ts - archivo privado
// de ese modulo (no exportado en su index.ts publico), duplicado a proposito, mismo criterio
// que CustomerSession (ver customer-session.ts). Header X-Client-Platform distingue web
// (refresh_token solo en cookie httpOnly/Secure/SameSite=Strict) de mobile (ambos tokens en
// el body JSON) - hoy el unico cliente real de autogestion es mobile, pero se mantiene el
// mismo contrato por si una tanda futura agrega un widget web.
export const CLIENT_PLATFORM_HEADER = 'x-client-platform';
export const CUSTOMER_REFRESH_TOKEN_COOKIE = 'customer_refresh_token';

export type ClientPlatform = 'web' | 'mobile';

export function resolveClientPlatform(headerValue: unknown): ClientPlatform {
  return headerValue === 'mobile' ? 'mobile' : 'web';
}
