// Auditoria de seguridad (docs/09-SEGURIDAD.md SS4, docs/persistence/10-DECISIONES.md #113) -
// reintentar un token de reset ya consumido/expirado es la misma clase de señal que reusar
// un refresh token ya rotado (SessionTheftDetected.v1, identity/domain) - mismo criterio de
// "auditar el reuso", no el precedente mas viejo de CustomerOtpChallenge (sin eventos).
export interface PasswordResetTokenReplayedEvent {
  eventType: 'PasswordResetTokenReplayed.v1';
  challengeId: string;
  userId: string;
}
