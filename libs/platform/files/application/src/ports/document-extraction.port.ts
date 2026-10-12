// docs/contracts/05-INTEGRATION-CONTRACTS.md SS4 (DocumentExtractionPort - OCR): extrae datos
// estructurados de un documento fotografiado como SUGERENCIA EDITABLE, nunca verdad de
// negocio automatica (RN-12/INV-011) - el resultado nunca crea ni verifica un IdentityDocument
// por si solo, solo pre-llena lo que el operador va a confirmar/editar antes de la carga real.
// Vive en files/application (scope:platform), no en customers/application (scope:product-
// rental, el consumidor real hoy) - tooling/eslint/boundaries.mjs prohibe a un modulo
// scope:platform (integration-providers, donde vive el adaptador concreto per ADR-0010)
// depender de scope:product-rental. Mismo criterio que StorageProviderPort (tambien opera
// sobre un fileId ya subido, tambien vive aca). documentType es un string generico (no
// DocumentType de @rental/customers/domain, por el mismo motivo de boundaries) - el
// consumidor (customers/application) decide si lo usa tal cual como sugerencia sin validar
// contra su catalogo cerrado.
export const DOCUMENT_EXTRACTION_PORT = Symbol('DocumentExtractionPort');

export interface ExtractedDocumentFields {
  documentType?: string;
  expiryDate?: Date;
  confidenceByField: Partial<Record<'documentType' | 'expiryDate', number>>;
}

export interface DocumentExtractionPort {
  // fileId de una imagen YA subida (reutiliza StorageProviderPort, nunca el binario directo).
  extract(fileId: string): Promise<ExtractedDocumentFields>;
}
