// docs/model/04-VALUE_OBJECTS.md SS3: "formato validado segun pais de registro" - sin un
// catalogo de paises/formatos fiscales especificado en ningun doc, se valida solo no-vacio
// (mismo criterio que RefreshTokenHash/PasswordHash: el VO envuelve el valor, la validacion
// de formato por pais queda para cuando el modelo de Company realmente distinga paises).
export class TaxId {
  private readonly value: string;

  private constructor(value: string) {
    this.value = value;
  }

  static from(raw: string): TaxId {
    const trimmed = raw.trim();
    if (trimmed.length === 0) {
      throw new TypeError('TaxId no puede estar vacio.');
    }
    return new TaxId(trimmed);
  }

  toString(): string {
    return this.value;
  }
}
