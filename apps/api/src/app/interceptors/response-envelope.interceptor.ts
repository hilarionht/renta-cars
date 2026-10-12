import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import { map, type Observable } from 'rxjs';

// docs/contracts/03-REQUEST-RESPONSE-STANDARDS.md SS2 / docs/08-API-CONTRACTS.md SS3:
// { data, meta } uniforme para toda respuesta 2xx exitosa - ningun Controller lo arma a
// mano. `warnings` se omite si el Controller no lo puso explicitamente en el resultado
// (ver EnvelopeWithExtras). `meta` opcional (docs/persistence/10-DECISIONES.md #112) permite
// que un Controller inyecte campos propios (p. ej. `nextCursor`/`limit` de paginacion) sobre
// la base {generatedAt, apiVersion} - la base siempre gana si colisiona una clave, contrato
// fijado y testeado, no implicito. Ultimo interceptor de la cadena (docs/technical/
// 03-BACKEND-ARCHITECTURE.md SS8).
export interface EnvelopeWithExtras<T> {
  data: T;
  warnings?: unknown[];
  meta?: Record<string, unknown>;
}

function hasEnvelopeExtras<T>(value: unknown): value is EnvelopeWithExtras<T> {
  return typeof value === 'object' && value !== null && 'data' in value;
}

@Injectable()
export class ResponseEnvelopeInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      map((result: unknown) => {
        const baseMeta = { generatedAt: new Date().toISOString(), apiVersion: 'v1' };

        if (hasEnvelopeExtras(result)) {
          const meta = { ...result.meta, ...baseMeta };

          return result.warnings !== undefined
            ? { data: result.data, meta, warnings: result.warnings }
            : { data: result.data, meta };
        }

        return { data: result, meta: baseMeta };
      }),
    );
  }
}
