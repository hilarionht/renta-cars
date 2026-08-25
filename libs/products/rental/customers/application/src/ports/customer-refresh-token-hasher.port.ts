// Espejo deliberado de platform/identity/application/src/ports/refresh-token-hasher.port.ts.
// SHA-256 (no argon2id) - misma justificacion que RefreshTokenHash: el control real contra
// fuerza bruta es la longitud del secreto (256 bits), no el costo del hash.
export const CUSTOMER_REFRESH_TOKEN_HASHER = Symbol('CustomerRefreshTokenHasher');

export interface CustomerRefreshTokenHasher {
  generate(): { plaintext: string; hash: string };
  hash(plaintext: string): string;
}
