import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
  RequestTimeoutException,
} from '@nestjs/common';
import { catchError, timeout, TimeoutError } from 'rxjs';

// docs/technical/03-BACKEND-ARCHITECTURE.md SS8, tercer interceptor: timeout por defecto -
// evita que una integracion externa colgada retenga un worker indefinidamente
// (docs/11-INTEGRACIONES.md SS12). 10s es un default conservador para esta tanda (sin
// endpoints que dependan de proveedores externos todavia); no hay ningun valor fijado en
// los docs para esto, se recalibra si un modulo futuro lo necesita distinto.
const DEFAULT_TIMEOUT_MS = 10_000;

@Injectable()
export class TimeoutInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): ReturnType<CallHandler['handle']> {
    return next.handle().pipe(
      timeout(DEFAULT_TIMEOUT_MS),
      catchError((err) => {
        if (err instanceof TimeoutError) {
          throw new RequestTimeoutException();
        }
        throw err;
      }),
    );
  }
}
