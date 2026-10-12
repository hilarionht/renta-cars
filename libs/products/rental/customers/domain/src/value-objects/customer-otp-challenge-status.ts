// Fase 5 cliente-autogestion (docs/persistence/10-DECISIONES.md #109). Expired cubre 2
// causas distintas a proposito (tiempo agotado O intentos agotados) - ver
// customer-otp-challenge.ts, ninguna se distingue de la otra al cliente.
export type CustomerOtpChallengeStatus = 'Pending' | 'Verified' | 'Expired';
