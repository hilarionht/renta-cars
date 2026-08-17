import { InvalidPaymentMethodError } from '../errors/invalid-payment-method.error';

// docs/model/04-VALUE_OBJECTS.md SS6: catalogo cerrado de 4 valores ("Tarjeta, efectivo,
// transferencia, billetera digital") - a diferencia de EnabledProductModules (conjunto
// abierto por diseño, ver value-objects/enabled-product-modules mas abajo en el mismo
// aggregate), este SI es un enum nativo.
export const PAYMENT_METHODS = ['Card', 'Cash', 'Transfer', 'DigitalWallet'] as const;

export type PaymentMethodValue = (typeof PAYMENT_METHODS)[number];

export class PaymentMethod {
  private constructor(private readonly value: PaymentMethodValue) {}

  static from(raw: string): PaymentMethod {
    if (!(PAYMENT_METHODS as readonly string[]).includes(raw)) {
      throw new InvalidPaymentMethodError(raw);
    }
    return new PaymentMethod(raw as PaymentMethodValue);
  }

  toString(): string {
    return this.value;
  }
}
