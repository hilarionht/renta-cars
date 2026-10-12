// VO minimo compartido - validacion sintactica basica, nunca reglas de negocio (docs/model/
// 04-VALUE_OBJECTS.md SS1, catalogado como "verdaderamente universal" junto a Email/Money/
// DateRange/EntityId, pero nunca implementado hasta esta tanda - mismo tipo de hueco que
// BranchName). Formato E.164 (`+` + codigo de pais + numero, sin espacios/guiones).
const PHONE_NUMBER_PATTERN = /^\+[1-9]\d{1,14}$/;

export class PhoneNumber {
  private readonly value: string;

  private constructor(value: string) {
    this.value = value;
  }

  static from(raw: string): PhoneNumber {
    const normalized = raw.trim();
    if (!PHONE_NUMBER_PATTERN.test(normalized)) {
      throw new TypeError(`PhoneNumber invalido (se espera E.164): "${raw}"`);
    }
    return new PhoneNumber(normalized);
  }

  equals(other: PhoneNumber): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
