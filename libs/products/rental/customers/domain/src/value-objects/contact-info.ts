import { Email, PhoneNumber } from '@platform/shared-kernel';

// docs/model/04-VALUE_OBJECTS.md SS5.1: "Email + telefono de un Customer... reutiliza
// Email/PhoneNumber". A diferencia de BillingContact (Organization, telefono opcional -
// "los docs no distinguen obligatoriedad"), aca ambos campos vienen listados sin
// opcionalidad - se modelan ambos requeridos.
export class ContactInfo {
  private constructor(
    private readonly email: Email,
    private readonly phone: PhoneNumber,
  ) {}

  static from(params: { email: string; phone: string }): ContactInfo {
    return new ContactInfo(Email.from(params.email), PhoneNumber.from(params.phone));
  }

  toEmail(): Email {
    return this.email;
  }

  toPhone(): PhoneNumber {
    return this.phone;
  }
}
