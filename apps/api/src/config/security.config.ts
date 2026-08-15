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
  // docs/09-SEGURIDAD.md SS6 pide un limite general mas laxo que uno especifico y mas
  // estricto para auth. Se simplifica a un unico limite global con el valor estricto de
  // auth (nunca MENOS estricto de lo que login/refresh necesitan) - separar ambos requiere
  // la sintaxis multi-throttler de @nestjs/throttler (@Throttle()/@SkipThrottle() por
  // named throttler), cuyo comportamiento exacto de exclusion no se valido en vivo en esta
  // tanda; un unico limite uniforme es la version simple y verificable, no una version
  // "a medias" de la separacion documentada. Ni este valor ni una eventual separacion estan
  // calibrados contra trafico real - Fase 6.
  throttle: {
    limit: 20,
    ttlSeconds: 60,
  },
}));
