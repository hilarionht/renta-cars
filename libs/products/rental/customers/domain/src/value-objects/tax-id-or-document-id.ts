// docs/model/04-VALUE_OBJECTS.md SS5.1: "identificacion fiscal/personal del cliente...
// formato dependiente de pais, distinto por CustomerType" - sin catalogo de paises/formatos
// especificado (mismo criterio que TaxId de Company: se valida solo no-vacio). Nombre
// TaxIdOrDocumentId, no TaxId/DocumentId (los docs no se deciden entre los dos) - coincide
// 1:1 con la columna ya fijada tax_id_or_document_id (docs/persistence/
// 04-COLUMNAS-CONCEPTUALES.md SS6). Copia propia del modulo, no reutiliza TaxId de Company -
// mismo criterio de aislamiento de dominio ya usado en toda la sesion (docs/
// 05-CONVENCIONES-BACKEND.md SS3).
export class TaxIdOrDocumentId {
  private constructor(private readonly value: string) {}

  static from(raw: string): TaxIdOrDocumentId {
    const trimmed = raw.trim();
    if (trimmed.length === 0) {
      throw new TypeError('TaxIdOrDocumentId no puede estar vacio.');
    }
    return new TaxIdOrDocumentId(trimmed);
  }

  toString(): string {
    return this.value;
  }
}
