import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

import { resolveCorrelationId, sendProblemDetails, typeUriFor } from './problem-details';

// docs/contracts/07-ERROR-CATALOG.md SS4: mapeo status -> code para excepciones sin `code`
// propio (p. ej. UnauthorizedException generico de Nest/Passport).
const STATUS_CODES: Readonly<Record<number, string>> = {
  400: 'VALIDATION_FAILED',
  401: 'UNAUTHENTICATED',
  403: 'FORBIDDEN',
  404: 'RESOURCE_NOT_FOUND',
  429: 'RATE_LIMITED',
};

interface ErrorResponseBody {
  code?: string;
  errors?: Array<{ field: string; code: string; message: string }>;
}

function isErrorResponseBody(value: unknown): value is ErrorResponseBody {
  return typeof value === 'object' && value !== null;
}

// docs/technical/03-BACKEND-ARCHITECTURE.md SS6: fallback global para cualquier excepcion
// no capturada por DomainExceptionFilter (mas especifico, registrado antes en
// apps/api/src/app/app.module.ts) - nunca expone detalle interno de un error no esperado.
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const correlationId = resolveCorrelationId(request);

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const responseBody = exception.getResponse();
      const body = isErrorResponseBody(responseBody) ? responseBody : undefined;
      const code = body?.code ?? STATUS_CODES[status] ?? 'INTERNAL_ERROR';

      sendProblemDetails(ctx.getResponse<Response>(), {
        type: typeUriFor(code),
        title: exception.message,
        status,
        detail: typeof responseBody === 'string' ? responseBody : exception.message,
        instance: request.url,
        code,
        correlationId,
        ...(body?.errors ? { errors: body.errors } : {}),
      });
      return;
    }

    // docs/contracts/07-ERROR-CATALOG.md SS4: INTERNAL_ERROR nunca expone detalle interno -
    // el detalle real vive en el log, correlacionado por correlationId.
    this.logger.error({ err: exception, correlationId }, 'Unhandled exception');

    sendProblemDetails(ctx.getResponse<Response>(), {
      type: typeUriFor('INTERNAL_ERROR'),
      title: 'Internal server error',
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      detail: 'Ocurrio un error inesperado. Contacta a soporte con el correlationId.',
      instance: request.url,
      code: 'INTERNAL_ERROR',
      correlationId,
    });
  }
}
