import { DomainError } from '@platform/shared-kernel';

// docs/model/04-VALUE_OBJECTS.md SS7: el allowlist es politica de Files (no un catalogo
// universal), pero un contentType rechazado necesita un codigo HTTP mapeado corregible por
// el cliente (422) - a diferencia de LegalName/TaxId (TypeError puro, sin mapeo), este SI
// es un DomainError.
export class UnsupportedContentTypeError extends DomainError {
  constructor(contentType: string) {
    super(`Tipo de contenido no soportado: "${contentType}".`);
  }
}
