// MFA TOTP (docs/persistence/10-DECISIONES.md #111). Expired cubre 2 causas distintas a
// proposito (tiempo agotado O intentos agotados), mismo criterio que
// CustomerOtpChallengeStatus - ninguna se distingue de la otra para el caller.
export type MfaLoginChallengeStatus = 'Pending' | 'Verified' | 'Expired';
