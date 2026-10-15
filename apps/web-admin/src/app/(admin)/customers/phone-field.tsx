'use client';

import { normalizePhoneNumber } from '@frontend/data-access-core';
import { TextField } from '@frontend/ui-kit-web';

// Telefono del cliente (docs/persistence/10-DECISIONES.md #139): se escribe como lo dicta el
// cliente y se muestra como queda guardado (E.164, Argentina por defecto). El API vuelve a
// validarlo y canonicaliza el 9 de movil.
export function parsePhoneInput(value: string): { e164?: string; error?: string } {
  if (!value.trim()) {
    return {};
  }
  const result = normalizePhoneNumber(value);
  return result.ok ? { e164: result.e164 } : { error: result.error };
}

export function PhoneField({
  value,
  onChange,
  label = 'Teléfono',
}: {
  value: string;
  onChange: (value: string) => void;
  label?: string;
}) {
  const phone = parsePhoneInput(value);
  return (
    <TextField
      label={label}
      type="tel"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      autoComplete="off"
      error={phone.error}
      hint={phone.e164 ? `Se guarda como ${phone.e164}` : 'Ej. 11 5555-4444 o +52 55 1234 5678'}
    />
  );
}
