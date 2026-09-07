// Decision de esta tanda (docs/08-API-CONTRACTS.md, adicion pendiente - ver reporte final):
// header X-Client-Platform distingue web (refresh_token solo en cookie httpOnly/Secure/
// SameSite=Strict, nunca en el body) de mobile (ambos tokens en el body JSON, storage
// seguro del dispositivo). Ausente o valor desconocido = web (default mas estricto).
export const CLIENT_PLATFORM_HEADER = 'x-client-platform';
export const REFRESH_TOKEN_COOKIE = 'refresh_token';

export type ClientPlatform = 'web' | 'mobile';

export function resolveClientPlatform(headerValue: unknown): ClientPlatform {
  return headerValue === 'mobile' ? 'mobile' : 'web';
}
