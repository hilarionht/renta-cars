import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  Logger,
  type NestInterceptor,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { tap } from 'rxjs';

import type { JwtPayload } from '../auth/jwt-payload.interface';
import { CORRELATION_ID_HEADER } from './correlation-id.interceptor';

// docs/technical/03-BACKEND-ARCHITECTURE.md SS8, segundo interceptor: entrada/salida de
// cada request con correlationId/companyId/duracion/resultado, log estructurado (nunca
// console.log - ya usa el Logger de Nest, que nestjs-pino redirige a pino JSON).
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): ReturnType<CallHandler['handle']> {
    const request = context.switchToHttp().getRequest<Request & { user?: JwtPayload }>();
    const response = context.switchToHttp().getResponse<Response>();
    const correlationId = request.headers[CORRELATION_ID_HEADER];
    const start = Date.now();

    return next.handle().pipe(
      tap({
        next: () => this.log(request, response, correlationId, start),
        error: () => this.log(request, response, correlationId, start),
      }),
    );
  }

  private log(
    request: Request & { user?: JwtPayload },
    response: Response,
    correlationId: unknown,
    start: number,
  ): void {
    this.logger.log({
      method: request.method,
      url: request.originalUrl,
      statusCode: response.statusCode,
      durationMs: Date.now() - start,
      correlationId,
      companyId: request.user?.companyId,
    });
  }
}
