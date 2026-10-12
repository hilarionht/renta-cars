// docs/model/08-STATE_MACHINES.md SS6.2: Active -> Rotated (refresh exitoso) | Revoked
// (logout/cambio de password/robo detectado). Rotated/Revoked son terminales - un nuevo
// login/refresh siempre crea una Session nueva, nunca reactiva una existente.
export type SessionStatus = 'Active' | 'Rotated' | 'Revoked';
