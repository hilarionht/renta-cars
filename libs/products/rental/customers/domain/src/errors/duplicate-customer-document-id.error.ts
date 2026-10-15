import { DomainError } from '@platform/shared-kernel';

// docs/persistence/10-DECISIONES.md #139: antes el P2002 de
// customers_company_id_tax_id_or_document_id_key respondia 500 (auditoria en vivo).
export class DuplicateCustomerDocumentIdError extends DomainError {
  constructor(taxIdOrDocumentId: string) {
    super(`Ya existe un customer con el documento "${taxIdOrDocumentId}" en esta company.`);
  }
}
