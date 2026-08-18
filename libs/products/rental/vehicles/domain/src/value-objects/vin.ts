// docs/model/04-VALUE_OBJECTS.md SS5.1: "17 caracteres alfanumericos (estandar ISO 3779)".
// ISO 3779 excluye I/O/Q (se confunden con 1/0) - regex preciso, mismo nivel de rigor que
// el E.164 de PhoneNumber.
const VIN_PATTERN = /^[A-HJ-NPR-Z0-9]{17}$/;

export class VIN {
  private constructor(private readonly value: string) {}

  static from(raw: string): VIN {
    const normalized = raw.trim().toUpperCase();
    if (!VIN_PATTERN.test(normalized)) {
      throw new TypeError(`VIN invalido (se espera ISO 3779, 17 caracteres): "${raw}"`);
    }
    return new VIN(normalized);
  }

  equals(other: VIN): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
