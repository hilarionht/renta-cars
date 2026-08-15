import { Email } from '@platform/shared-kernel';

// docs/model/04-VALUE_OBJECTS.md SS3: "Email/telefono validos". Email requerido (canal
// principal de contacto de facturacion), telefono opcional - los docs no distinguen
// obligatoriedad entre ambos campos, se elige el minimo que satisface "datos de contacto"
// sin inventar una regla de negocio sobre por que el telefono seria obligatorio.
export class BillingContact {
  private constructor(
    private readonly email: Email,
    private readonly phone?: string,
  ) {}

  static from(params: { email: string; phone?: string }): BillingContact {
    return new BillingContact(Email.from(params.email), params.phone?.trim() || undefined);
  }

  toEmail(): Email {
    return this.email;
  }

  toPhone(): string | undefined {
    return this.phone;
  }
}
