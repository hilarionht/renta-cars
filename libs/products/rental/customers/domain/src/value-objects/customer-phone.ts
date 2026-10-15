// docs/persistence/10-DECISIONES.md #139: forma canonica del telefono de un Customer. El telefono
// se usa para el login por codigo de WhatsApp y es unico por company, asi que dos escrituras
// del mismo numero tienen que ser el mismo valor.
//
// Politica (decision del usuario): pais por defecto Argentina, celulares. En Argentina el mismo
// celular se escribe +54 9 11 ... o +54 11 ...; se guarda SIEMPRE con el 9 de movil. Ningun
// codigo de area argentino empieza con 9, asi que "+54" seguido de algo que no es 9 es la
// forma sin el 9. Los demas paises se dejan como vienen (ya validados como E.164 por
// PhoneNumber). La normalizacion de formatos nacionales ("11 5555-4444") la hace el cliente
// (web/mobile, @frontend/data-access-core normalizePhoneNumber); aca solo se unifica E.164.
const ARGENTINA_WITHOUT_MOBILE_PREFIX = /^\+54(?!9)(\d+)$/;

export function canonicalCustomerPhone(raw: string): string {
  const trimmed = raw.trim();
  const match = ARGENTINA_WITHOUT_MOBILE_PREFIX.exec(trimmed);
  return match ? `+549${match[1]}` : trimmed;
}
