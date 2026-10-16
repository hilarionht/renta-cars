import { PhoneNumber } from '@platform/shared-kernel';

// docs/persistence/10-DECISIONES.md #140: el telefono de facturacion se valida (E.164) solo cuando
// viene en la solicitud. BillingContact no lo valida al cargar: un dato viejo guardado (p. ej.
// "abc") no puede trabar la company.
export function billingPhoneFromInput(raw: string | undefined): string | undefined {
  const trimmed = raw?.trim();
  return trimmed ? PhoneNumber.from(trimmed).toString() : undefined;
}
