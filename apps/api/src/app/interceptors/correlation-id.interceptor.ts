import { randomUUID } from 'node:crypto';

import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import type { Observable } from 'rxjs';

// docs/technical/03-BACKEND-ARCHITECTURE.md SS8, primer interceptor de la cadena: obtiene o
// genera el correlationId antes que cualquier otro interceptor/filter lo necesite
// (problem-details.ts ya lee `x-correlation-id` de la request via resolveCorrelationId).
export const CORRELATION_ID_HEADER = 'x-correlation-id';

@Injectable()
export class CorrelationIdInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    const correlationId = request.headers[CORRELATION_ID_HEADER]?.toString() ?? randomUUID();
    request.headers[CORRELATION_ID_HEADER] = correlationId;
    response.setHeader(CORRELATION_ID_HEADER, correlationId);

    return next.handle();
  }
}
