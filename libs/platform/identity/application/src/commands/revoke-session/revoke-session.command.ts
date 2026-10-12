// El cliente conoce su refresh_token (cookie o valor guardado), nunca el sessionId interno
// - logout busca la Session por el mismo hash que refresh usa, no por id.
export interface RevokeSessionCommand {
  refreshToken: string;
  reason: string;
}
