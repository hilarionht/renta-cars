import { Injectable, Logger } from '@nestjs/common';
import { ThrottlerException, ThrottlerGuard, type ThrottlerRequest } from '@nestjs/throttler';

// docs/persistence/10-DECISIONES.md #114/#119: ThrottlerGuard.canActivate() (@nestjs/throttler)
// llama handleRequest() -> storageService.increment() sin ningun try/catch - un fallo de
// Redis se propagaba sin manejar (o colgaba, con la politica de reintento de
// CACHE_REDIS_CLIENT). Como ThrottlerGuard es un guard GLOBAL (APP_GUARD, app.module.ts),
// eso afectaba TODA la API, no solo el rate limiting. Decision explicita del usuario (vía
// AskUserQuestion, entre fail-open/fail-closed-en-auth/fail-closed-en-todo): fail-open en
// toda ruta - el throttler no tiene un fallback real (a diferencia de CachedRoleLookupAdapter,
// que cae a Postgres), asi que la alternativa a fail-open es negar TODA la API durante una
// caida de Redis, el mismo radio de impacto que el bug que esto arregla, solo que con un 503
// inmediato en vez de un cuelgue - fail-open es la unica opcion que realmente restaura
// disponibilidad. Combinado con THROTTLER_REDIS_CLIENT (apps/api/src/app/redis), tuneado
// fail-fast para que el catch de abajo dispare en ~2s, no despues de reintentos indefinidos.
@Injectable()
export class FailOpenThrottlerGuard extends ThrottlerGuard {
  private readonly logger = new Logger(FailOpenThrottlerGuard.name);

  protected override async handleRequest(requestProps: ThrottlerRequest): Promise<boolean> {
    try {
      return await super.handleRequest(requestProps);
    } catch (error) {
      // ThrottlerException es el resultado NORMAL de superar el limite (429) - nunca se
      // atrapa aca, debe seguir propagando. Solo un fallo de infraestructura (Redis caido)
      // cae al fail-open de abajo.
      if (error instanceof ThrottlerException) {
        throw error;
      }
      this.logger.warn(
        `Redis no disponible para el throttler, fail-open (la request pasa sin rate limiting): ${String(error)}`,
      );
      return true;
    }
  }
}
