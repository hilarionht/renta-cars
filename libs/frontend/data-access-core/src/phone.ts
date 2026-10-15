// docs/persistence/10-DECISIONES.md #139 (gap de #133): normalizacion de telefonos a E.164 en
// el cliente, con Argentina como pais por defecto. Los celulares argentinos llevan el 9 de
// movil (+549...), el mismo criterio que canonicalCustomerPhone del backend: un +54 sin el 9
// se completa, asi el numero que ve el usuario es el mismo que se guarda.
//
// Solo Argentina tiene reglas de formato nacional; un numero de otro pais se escribe con +.

export type PhoneCountry = 'AR';

export type NormalizedPhone = { ok: true; e164: string } | { ok: false; error: string };

const E164 = /^\+[1-9]\d{7,14}$/;
const SEPARATORS = /[\s\-().]/g;

function fail(error: string): NormalizedPhone {
  return { ok: false, error };
}

function withArgentineMobilePrefix(e164: string): string {
  return e164.startsWith('+54') && !e164.startsWith('+549') ? `+549${e164.slice(3)}` : e164;
}

export function normalizePhoneNumber(input: string, country: PhoneCountry = 'AR'): NormalizedPhone {
  let raw = input.replace(SEPARATORS, '');
  if (raw.length === 0) {
    return fail('Ingresa un numero de telefono.');
  }
  if (raw.startsWith('00')) {
    raw = `+${raw.slice(2)}`;
  }

  if (raw.startsWith('+')) {
    if (!E164.test(raw)) {
      return fail('El numero internacional no es valido (ej. +5491155554444).');
    }
    return { ok: true, e164: withArgentineMobilePrefix(raw) };
  }

  if (!/^\d+$/.test(raw)) {
    return fail('El telefono solo puede tener numeros.');
  }

  switch (country) {
    case 'AR':
      return normalizeArgentineNumber(raw);
  }
}

// Numero nacional argentino: codigo de area + abonado = 10 digitos (11 5555-4444). Se acepta
// con el 0 de larga distancia, con el 9 de movil, o con el 54 del pais sin el +.
function normalizeArgentineNumber(digits: string): NormalizedPhone {
  if (digits.startsWith('549') && digits.length === 13) {
    return { ok: true, e164: `+${digits}` };
  }
  if (digits.startsWith('54') && digits.length === 12) {
    return { ok: true, e164: `+549${digits.slice(2)}` };
  }
  const national = digits.startsWith('0') ? digits.slice(1) : digits;
  if (national.startsWith('9') && national.length === 11) {
    return { ok: true, e164: `+54${national}` };
  }
  if (national.length === 10) {
    return { ok: true, e164: `+549${national}` };
  }
  if (national.length === 12) {
    // Area + 15 + abonado (011 15 5555-4444): el 15 no forma parte del numero en E.164 y no
    // se puede quitar a ciegas (no se sabe donde termina el codigo de area).
    return fail('Ingresa el numero sin el 15 (ej. 11 5555-4444).');
  }
  return fail('El numero debe tener codigo de area y numero (ej. 11 5555-4444).');
}
