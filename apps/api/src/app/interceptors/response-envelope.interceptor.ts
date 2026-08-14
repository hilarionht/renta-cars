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
// (ver EnvelopeWithWarnings). Ultimo interceptor de la cadena (docs/technical/
// 03-BACKEND-ARCHITECTURE.md SS8).
export interface EnvelopeWithWarnings<T> {
  data: T;
  warnings: unknown[];
}

function hasWarnings<T>(value: unknown): value is EnvelopeWithWarnings<T> {
  return typeof value === 'object' && value !== null && 'data' in value && 'warnings' in value;
}

@Injectable()
export class ResponseEnvelopeInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      map((result: unknown) => {
        const meta = { generatedAt: new Date().toISOString(), apiVersion: 'v1' };

        if (hasWarnings(result)) {
          return { data: result.data, meta, warnings: result.warnings };
        }

        return { data: result, meta };
      }),
    );
  }
}
