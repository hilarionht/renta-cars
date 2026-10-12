// SHA-256 (no argon2id) - ver justificacion en domain/value-objects/refresh-token-hash.ts.
// generate() produce el token en claro (nunca persistido) + su hash (lo unico que se
// guarda); hash() recalcula el hash de un token presentado por el cliente, para buscar la
// Session correspondiente por refresh_token_hash (unico globalmente).
export const REFRESH_TOKEN_HASHER = Symbol('RefreshTokenHasher');

export interface RefreshTokenHasher {
  generate(): { plaintext: string; hash: string };
  hash(plaintext: string): string;
}
