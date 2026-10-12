// docs/model/04-VALUE_OBJECTS.md SS3 - razon social de la Company. Validacion sintactica
// minima, nunca regla de negocio en un VO (mismo criterio que RoleName/PersonName).
const MIN_LENGTH = 2;
const MAX_LENGTH = 200;

export class LegalName {
  private readonly value: string;

  private constructor(value: string) {
    this.value = value;
  }

  static from(raw: string): LegalName {
    const trimmed = raw.trim();
    if (trimmed.length < MIN_LENGTH || trimmed.length > MAX_LENGTH) {
      throw new TypeError(
        `LegalName debe tener entre ${MIN_LENGTH} y ${MAX_LENGTH} caracteres: "${raw}"`,
      );
    }
    return new LegalName(trimmed);
  }

  toString(): string {
    return this.value;
  }
}
