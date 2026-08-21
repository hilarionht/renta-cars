import { InvalidPaymentMethodError } from '../errors/invalid-payment-method.error';

// docs/model/04-VALUE_OBJECTS.md SS6 - catalogo cerrado de 4 valores, identico al de
// platform-settings-domain (PaymentMethodsEnabled) pero definido localmente, no importado
// cross-modulo - reservations/application no puede depender de type:domain de otro modulo
// (tooling/eslint/boundaries.mjs, INV-P03), mismo criterio ya aplicado a DamageSeverity en
// Reservations.
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

  // RN-24: metodos con preautorizacion (Card, DigitalWallet) exigen authorize() antes de
  // capture(); Cash/Transfer saltan directo a capture() ("registro manual",
  // docs/model/08-STATE_MACHINES.md SS3.1).
  requiresPreAuthorization(): boolean {
    return this.value === 'Card' || this.value === 'DigitalWallet';
  }

  toString(): string {
    return this.value;
  }
}
