// docs/09-SEGURIDAD.md SS6 / docs/technical/07-SECURITY.md SS5: perfiles de limite
// distintos por grupo de ruta (auth mas estricto, write-heavy intermedio, el resto con el
// limite general). Viven aca (no en apps/api/src/config/security.config.ts) porque
// @Throttle() necesita valores literales en tiempo de decoracion de clase, no una llamada
// async a ConfigService - y los controllers que aplican el perfil auth/write-heavy son
// libs/ (libs/ no puede importar apps/api, tooling/eslint/boundaries.mjs), mismo motivo
// estructural exacto que RequirePermission()/REQUIRE_PERMISSION_KEY en este mismo
// directorio. security.config.ts importa GENERAL_THROTTLE_PROFILE para el throttler
// registrado globalmente; auth.controller.ts/reservations.controller.ts importan
// AUTH_THROTTLE_PROFILE/WRITE_HEAVY_THROTTLE_PROFILE directo para @Throttle().
//
// Valores baseline conservadores, explicitamente NO finales - mismo criterio que
// security.config.ts ya usa para argon2id: SS9 de 09-SEGURIDAD.md difiere la calibracion
// final contra trafico real a Fase 6 (verificado que ninguno de los 17 e2e existentes se
// acerca a estos limites corriendo individualmente: maximo 5 logins y 2 creates de
// reservation en un mismo archivo).
export const AUTH_THROTTLE_PROFILE = { limit: 8, ttlSeconds: 60 } as const;
export const WRITE_HEAVY_THROTTLE_PROFILE = { limit: 15, ttlSeconds: 60 } as const;
export const GENERAL_THROTTLE_PROFILE = { limit: 20, ttlSeconds: 60 } as const;
