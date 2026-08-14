// docs/09-SEGURIDAD.md SS3: argon2id. La implementacion real (infrastructure/providers)
// importa @node-rs/argon2 - application/ solo conoce este puerto.
export const PASSWORD_HASHER = Symbol('PasswordHasher');

export interface PasswordHasher {
  hash(plainPassword: string): Promise<string>;
  verify(hash: string, plainPassword: string): Promise<boolean>;
}
