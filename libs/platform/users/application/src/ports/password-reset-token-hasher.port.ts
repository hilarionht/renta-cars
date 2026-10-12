// Duplicado deliberado de RefreshTokenHasher (identity/application) - mismo criterio que
// CustomerRefreshTokenHasher (rental/customers): "espejo deliberado", aislar el mecanismo de
// auth de este modulo del de identity, no compartir el puerto cruzando modulos.
export const PASSWORD_RESET_TOKEN_HASHER = Symbol('PasswordResetTokenHasher');

export interface PasswordResetTokenHasher {
  generate(): { plaintext: string; hash: string };
  hash(plaintext: string): string;
}
