// docs/model/03-ENTITIES.md - "nombre" como propiedad conceptual, sin split de
// firstName/lastName especificado en los docs (huella abierta, ver plan de esta tanda) -
// se implementa como un unico campo, el mas simple que satisface lo que si esta escrito.
const MIN_LENGTH = 2;
const MAX_LENGTH = 120;

export class PersonName {
  private readonly value: string;

  private constructor(value: string) {
    this.value = value;
  }

  static from(raw: string): PersonName {
    const trimmed = raw.trim();
    if (trimmed.length < MIN_LENGTH || trimmed.length > MAX_LENGTH) {
      throw new TypeError(
        `PersonName debe tener entre ${MIN_LENGTH} y ${MAX_LENGTH} caracteres: "${raw}"`,
      );
    }
    return new PersonName(trimmed);
  }

  toString(): string {
    return this.value;
  }
}
