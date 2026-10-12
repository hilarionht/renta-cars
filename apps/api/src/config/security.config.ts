import { registerAs } from '@nestjs/config';

import { GENERAL_THROTTLE_PROFILE } from '@platform/persistence-kernel';

// Namespace "security" - parametros de argon2id (docs/09-SEGURIDAD.md SS3) y perfil
// general de rate limit (SS6). NINGUNO de estos dos grupos de valores esta calibrado en
// los docs a proposito - SS9 lo difiere explicitamente a Fase 6/Hardening contra trafico
// real. Los de aca son baseline conservador de OWASP (Password Storage Cheat Sheet,
// argon2id m=19MiB/t=2/p=1), no valores "finales". No son variables de entorno (a
// diferencia de JWT) porque son una decision de seguridad de codigo, no configuracion que
// deba variar por entorno.
export default registerAs('security', () => ({
  argon2: {
    memoryCost: 19_456, // KiB
    timeCost: 2,
    parallelism: 1,
  },
  // Perfil GENERAL unicamente (el throttler 'default' registrado globalmente en
  // app.module.ts) - los perfiles auth/write-heavy, mas estrictos, se aplican directo en
  // sus controllers via @Throttle() (AUTH_THROTTLE_PROFILE/WRITE_HEAVY_THROTTLE_PROFILE de
  // @platform/persistence-kernel, no de aca - @Throttle() necesita valores literales en
  // tiempo de decoracion, no ConfigService, y esos controllers viven en libs/ que no puede
  // importar apps/api). Los 3 perfiles comparten un unico source of truth
  // (throttle-profiles.ts) para no duplicar numeros. Ninguno esta calibrado contra
  // trafico real - Fase 6.
  throttle: GENERAL_THROTTLE_PROFILE,
}));
