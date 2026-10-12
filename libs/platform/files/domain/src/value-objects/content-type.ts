import { UnsupportedContentTypeError } from '../errors/unsupported-content-type.error';

// Allowlist conservador acordado con el usuario (fotos de vehiculo/cliente + PDFs de
// factura/documento) - docs/model/04-VALUE_OBJECTS.md SS7 delega la lista "al modulo
// consumidor", pero ningun consumidor (Vehicles/Customers/Invoices) existe todavia en esta
// fase, asi que Files aplica un piso de seguridad propio en vez de aceptar cualquier tipo.
export const ALLOWED_CONTENT_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
] as const;

export type AllowedContentType = (typeof ALLOWED_CONTENT_TYPES)[number];

export class ContentType {
  private constructor(private readonly value: AllowedContentType) {}

  static from(raw: string): ContentType {
    if (!(ALLOWED_CONTENT_TYPES as readonly string[]).includes(raw)) {
      throw new UnsupportedContentTypeError(raw);
    }
    return new ContentType(raw as AllowedContentType);
  }

  toString(): string {
    return this.value;
  }
}
