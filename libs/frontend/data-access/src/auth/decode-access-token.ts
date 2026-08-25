// libs/platform/identity/application/src/ports/token-signer.port.ts (AccessTokenClaims):
// { sub, companyId, branchId?, roles }, RS256. El login (docs/08-API-CONTRACTS.md SS9.1)
// nunca devuelve el userId aparte - decodificar el payload es la unica fuente. Sin
// verificar firma (el backend ya la re-valida en cada request via JwtAuthGuard - esto es
// solo para leer/mostrar el userId client-side, nunca para autorizar nada localmente).
//
// base64url decodificado a mano: ni atob() (no entiende el alfabeto '-'/'_' de base64url,
// y no existe como global en todos los engines de React Native) ni Buffer (global de Node,
// no garantizado en Hermes/React Native) son opciones seguras aca - una tabla de lookup
// evita ambas dependencias, funciona igual en Jest (Node) y en el dispositivo.
export interface AccessTokenClaims {
  sub: string;
  companyId: string;
  branchId?: string;
  roles: string[];
}

const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function base64UrlDecode(segment: string): string {
  const base64 = segment.replace(/-/g, '+').replace(/_/g, '/');
  let bits = 0;
  let bitCount = 0;
  let output = '';
  for (const char of base64) {
    const value = BASE64_ALPHABET.indexOf(char);
    if (value === -1) {
      continue;
    }
    bits = (bits << 6) | value;
    bitCount += 6;
    if (bitCount >= 8) {
      bitCount -= 8;
      output += String.fromCharCode((bits >> bitCount) & 0xff);
    }
  }
  return decodeURIComponent(
    output
      .split('')
      .map((char) => '%' + char.charCodeAt(0).toString(16).padStart(2, '0'))
      .join(''),
  );
}

export function decodeAccessToken(accessToken: string): AccessTokenClaims {
  const [, payloadSegment] = accessToken.split('.');
  if (!payloadSegment) {
    throw new Error('accessToken invalido: falta el segmento de payload.');
  }
  return JSON.parse(base64UrlDecode(payloadSegment)) as AccessTokenClaims;
}
