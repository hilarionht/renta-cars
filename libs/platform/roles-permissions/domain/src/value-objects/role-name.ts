// docs/model/04-VALUE_OBJECTS.md - nombre de un Role, unico por company (o global si es
// System, docs/persistence/05-INDICES-Y-CONSTRAINTS.md). Validacion sintactica minima -
// nunca reglas de negocio en un VO.
const MIN_LENGTH = 2;
const MAX_LENGTH = 60;

export class RoleName {
  private readonly value: string;

  private constructor(value: string) {
    this.value = value;
  }

  static from(raw: string): RoleName {
    const trimmed = raw.trim();
    if (trimmed.length < MIN_LENGTH || trimmed.length > MAX_LENGTH) {
      throw new TypeError(
        `RoleName debe tener entre ${MIN_LENGTH} y ${MAX_LENGTH} caracteres: "${raw}"`,
      );
    }
    return new RoleName(trimmed);
  }

  equals(other: RoleName): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
