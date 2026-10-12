// VO agregado - docs/model/04-VALUE_OBJECTS.md SS3 no lista un nombre para Branch (solo
// Address/OperatingHours/BranchStatus), mismo hueco que PersonName tuvo para User. Una
// sucursal sin nombre no es usable en ningun flujo real - validacion sintactica minima,
// nunca regla de negocio (ver docs/model/02-AGGREGATES.md §5 actualizado en el mismo cambio).
const MIN_LENGTH = 2;
const MAX_LENGTH = 120;

export class BranchName {
  private readonly value: string;

  private constructor(value: string) {
    this.value = value;
  }

  static from(raw: string): BranchName {
    const trimmed = raw.trim();
    if (trimmed.length < MIN_LENGTH || trimmed.length > MAX_LENGTH) {
      throw new TypeError(
        `BranchName debe tener entre ${MIN_LENGTH} y ${MAX_LENGTH} caracteres: "${raw}"`,
      );
    }
    return new BranchName(trimmed);
  }

  toString(): string {
    return this.value;
  }
}
