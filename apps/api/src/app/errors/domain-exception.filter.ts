import { type ArgumentsHost, Catch, type ExceptionFilter, Inject, Logger } from '@nestjs/common';
import type { Request, Response } from 'express';

import { DomainError } from '@platform/shared-kernel';

import {
  DOMAIN_ERROR_REGISTRY,
  type DomainErrorConstructor,
  type DomainErrorRegistry,
} from './domain-error-registry';
import { resolveCorrelationId, sendProblemDetails, typeUriFor } from './problem-details';

// docs/technical/03-BACKEND-ARCHITECTURE.md SS6: traduce cada subclase de DomainError a
// RFC 7807 usando el registro declarativo - nunca un switch creciente por tipo de error.
// Mas especifico que AllExceptionsFilter (@Catch() sin argumento) - Nest evalua los
// APP_FILTER al reves del orden de registro (el ultimo registrado se prueba primero,
// verificado a mano), por eso este filtro se registra DESPUES de AllExceptionsFilter en
// apps/api/src/app/app.module.ts.
@Catch(DomainError)
export class DomainExceptionFilter implements ExceptionFilter<DomainError> {
  private readonly logger = new Logger(DomainExceptionFilter.name);

  constructor(@Inject(DOMAIN_ERROR_REGISTRY) private readonly registry: DomainErrorRegistry) {}

  catch(exception: DomainError, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const correlationId = resolveCorrelationId(request);

    const mapping = this.registry.get(exception.constructor as DomainErrorConstructor);

    if (!mapping) {
      // Un DomainError sin entrada en su propio registro de modulo es un error de
      // desarrollo (docs/technical/09-CODING-STANDARDS.md SS3) - no debe llegar nunca a
      // produccion sin su mapeo, pero no debe tampoco tirar la respuesta al cliente.
      this.logger.error(
        { err: exception, correlationId },
        `DomainError "${exception.constructor.name}" sin entrada en DOMAIN_ERROR_REGISTRY`,
      );
    }

    const status = mapping?.status ?? 500;
    const code = mapping?.code ?? 'INTERNAL_ERROR';

    sendProblemDetails(ctx.getResponse<Response>(), {
      type: typeUriFor(code),
      title: mapping?.title ?? 'Unmapped domain error',
      status,
      detail: exception.message,
      instance: request.url,
      code,
      correlationId,
    });
  }
}
