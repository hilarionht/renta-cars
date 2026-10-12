// VO minimo compartido - docs/model/04-VALUE_OBJECTS.md SS1.1, catalogado como
// "verdaderamente universal" junto a Email/PhoneNumber/DateRange/EntityId, pero nunca
// implementado hasta esta tanda (Vehicles) - mismo tipo de hueco que PhoneNumber antes de
// Customers. Monto SIEMPRE entero en unidad minima (nunca float, docs/04-MODELO-DATOS.md
// SS5) - moneda validada por forma (3 letras mayusculas), sin catalogo ISO-4217 real, mismo
// pragmatismo que el regex E.164 de PhoneNumber.
const CURRENCY_PATTERN = /^[A-Z]{3}$/;

export class Money {
  private readonly amountMinorUnits: number;
  private readonly currency: string;

  private constructor(amountMinorUnits: number, currency: string) {
    this.amountMinorUnits = amountMinorUnits;
    this.currency = currency;
  }

  static from(amountMinorUnits: number, currency: string): Money {
    if (!Number.isInteger(amountMinorUnits) || amountMinorUnits < 0) {
      throw new TypeError(
        `Money.amountMinorUnits debe ser un entero no negativo: ${amountMinorUnits}`,
      );
    }
    if (!CURRENCY_PATTERN.test(currency)) {
      throw new TypeError(`Money.currency invalido (se espera ISO-4217, 3 letras): "${currency}"`);
    }
    return new Money(amountMinorUnits, currency);
  }

  add(other: Money): Money {
    if (this.currency !== other.currency) {
      throw new TypeError(
        `No se puede sumar Money de monedas distintas: "${this.currency}" y "${other.currency}"`,
      );
    }
    return new Money(this.amountMinorUnits + other.amountMinorUnits, this.currency);
  }

  equals(other: Money): boolean {
    return this.amountMinorUnits === other.amountMinorUnits && this.currency === other.currency;
  }

  get minorUnits(): number {
    return this.amountMinorUnits;
  }

  get currencyCode(): string {
    return this.currency;
  }
}
