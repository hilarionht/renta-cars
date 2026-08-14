import { registerAs } from '@nestjs/config';

// Namespace "security" - parametros de argon2id (docs/09-SEGURIDAD.md SS3) y umbrales de
// rate limit en `auth` (SS6). NINGUNO de estos dos grupos de valores esta calibrado en los
// docs a proposito - SS9 lo difiere explicitamente a Fase 6/Hardening contra trafico real.
// Los de aca son baseline conservador de OWASP (Password Storage Cheat Sheet, argon2id
// m=19MiB/t=2/p=1) y un limite de login razonable, no valores "finales". No son variables
// de entorno (a diferencia de JWT) porque son una decision de seguridad de codigo, no
// configuracion que deba variar por entorno.
export default registerAs('security', () => ({
  argon2: {
    memoryCost: 19_456, // KiB
    timeCost: 2,
    parallelism: 1,
  },
  authThrottle: {
    limit: 5,
    ttlSeconds: 60,
  },
}));
