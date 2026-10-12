// El cliente conoce su refresh_token, nunca el customerSessionId interno - logout busca la
// CustomerSession por el mismo hash que refresh usa, no por id.
export interface RevokeCustomerSessionCommand {
  refreshToken: string;
  reason: string;
}
