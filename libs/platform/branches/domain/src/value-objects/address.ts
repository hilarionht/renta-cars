// docs/model/04-VALUE_OBJECTS.md SS3 - "Direccion fisica... sin identidad propia". Sin mas
// estructura especificada en los docs, se modela el minimo pragmatico: linea1/ciudad/pais
// obligatorios, el resto opcional (formato varia demasiado entre paises para exigirlo).
export interface AddressProps {
  line1: string;
  line2?: string;
  city: string;
  stateProvince?: string;
  postalCode?: string;
  country: string;
}

export class Address {
  private constructor(private readonly props: AddressProps) {}

  static from(raw: AddressProps): Address {
    const line1 = raw.line1.trim();
    const city = raw.city.trim();
    const country = raw.country.trim();
    if (line1.length === 0 || city.length === 0 || country.length === 0) {
      throw new TypeError('Address requiere line1, city y country no vacios.');
    }
    return new Address({
      line1,
      line2: raw.line2?.trim() || undefined,
      city,
      stateProvince: raw.stateProvince?.trim() || undefined,
      postalCode: raw.postalCode?.trim() || undefined,
      country,
    });
  }

  toProps(): AddressProps {
    return { ...this.props };
  }
}
