// Auditoria de seguridad (docs/09-SEGURIDAD.md SS4) - mismo criterio que LoginFailed.v1: un
// intento de segundo factor fallido es tan auditable como una contrasena incorrecta.
export interface MfaVerificationFailedEvent {
  eventType: 'MfaVerificationFailed.v1';
  mfaChallengeId: string;
  userId: string;
  companyId: string;
}
