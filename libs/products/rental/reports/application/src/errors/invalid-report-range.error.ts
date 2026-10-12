import { DomainError } from '@platform/shared-kernel';

// Sin precedente de validacion cross-field (`from <= to`) en ningun DTO del repo - el guard
// vive en cada Query Handler, no en un `@Validate()` custom nuevo (docs/persistence/
// 10-DECISIONES.md Fase 4, item 1). DomainError vive en shared-kernel (scope:shared),
// utilizable sin capa `domain` propia - reports es el unico modulo sin ella
// (docs/technical/01-MONOREPO.md SS3.1).
export class InvalidReportRangeError extends DomainError {
  constructor(from: string, to: string) {
    super(`El rango de fechas es invalido: "from" (${from}) es posterior a "to" (${to}).`);
  }
}
