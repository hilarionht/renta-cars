// VO minimo compartido - validacion sintactica basica, nunca reglas de negocio (docs/model/
// 04-VALUE_OBJECTS.md SS1). Normaliza a minusculas para que la igualdad de VO coincida con
// la unicidad de base (docs/persistence/05-INDICES-Y-CONSTRAINTS.md: unique (company_id,
// email) es case-sensitive a nivel de Postgres, la normalizacion pasa por aca).
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class Email {
  private readonly value: string;

  private constructor(value: string) {
    this.value = value;
  }

  static from(raw: string): Email {
    const normalized = raw.trim().toLowerCase();
    if (!EMAIL_PATTERN.test(normalized)) {
      throw new TypeError(`Email invalido: "${raw}"`);
    }
    return new Email(normalized);
  }

  equals(other: Email): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
