import { randomUUID } from 'node:crypto';

import type { Request, Response } from 'express';

// Forma exacta del envelope de error - docs/contracts/03-REQUEST-RESPONSE-STANDARDS.md SS3
// (RFC 7807 + code + correlationId, hereda docs/08-API-CONTRACTS.md SS4).
export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance: string;
  code: string;
  correlationId: string;
  errors?: Array<{ field: string; code: string; message: string }>;
}

// docs/contracts/03-REQUEST-RESPONSE-STANDARDS.md SS6: preserva X-Correlation-Id del
// cliente si lo envio, genera uno si no.
export function resolveCorrelationId(request: Request): string {
  const header = request.headers['x-correlation-id'];
  return (Array.isArray(header) ? header[0] : header) ?? randomUUID();
}

export function sendProblemDetails(response: Response, problem: ProblemDetails): void {
  response
    .status(problem.status)
    .set('X-Correlation-Id', problem.correlationId)
    .type('application/problem+json')
    .send(problem);
}

export function typeUriFor(code: string): string {
  return `https://docs.platform/errors/${code.toLowerCase().replace(/_/g, '-')}`;
}
