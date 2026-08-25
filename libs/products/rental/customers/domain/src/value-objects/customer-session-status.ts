// Espejo de libs/platform/identity/domain/src/value-objects/session-status.ts - duplicado a
// proposito (Fase 5 cliente-autogestion, docs/persistence/10-DECISIONES.md #109), no
// reusado: type:domain solo puede depender de type:domain del MISMO modulo o scope:shared
// (tooling/eslint/boundaries.mjs), asi que CustomerSession no puede importar nada de
// platform/identity/domain aunque quisiera - y aunque pudiera, el usuario eligio
// explicitamente "paralela" para no acoplar el mecanismo de auth de staff (ya probado, en
// produccion) al nuevo de customers. Active -> Rotated (refresh exitoso) | Revoked
// (logout/robo detectado) - Rotated/Revoked terminales.
export type CustomerSessionStatus = 'Active' | 'Rotated' | 'Revoked';
