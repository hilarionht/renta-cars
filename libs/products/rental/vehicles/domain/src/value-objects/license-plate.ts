// docs/model/04-VALUE_OBJECTS.md SS5.1: "formato varia por pais, pero el concepto
// (identificador registral legal) es un valor puro". Sin catalogo de formatos por pais
// (no construido), se valida solo forma minima - mismo pragmatismo que TaxIdOrDocumentId
// (Customers): no vacio, normalizado a mayusculas (las placas no distinguen case en ningun
// pais real).
const MIN_LENGTH = 2;
const MAX_LENGTH = 12;

export class LicensePlate {
  private constructor(private readonly value: string) {}

  static from(raw: string): LicensePlate {
    const normalized = raw.trim().toUpperCase();
    if (normalized.length < MIN_LENGTH || normalized.length > MAX_LENGTH) {
      throw new TypeError(
        `LicensePlate debe tener entre ${MIN_LENGTH} y ${MAX_LENGTH} caracteres: "${raw}"`,
      );
    }
    return new LicensePlate(normalized);
  }

  equals(other: LicensePlate): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
