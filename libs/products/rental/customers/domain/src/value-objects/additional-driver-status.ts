// docs/model/08-STATE_MACHINES.md SS6.6: Registered -> Validated -> Revoked. Revoked no
// vuelve a Validated directo (requiere volver a Registered y re-validar).
export type AdditionalDriverStatus = 'Registered' | 'Validated' | 'Revoked';
