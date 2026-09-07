// docs/model/04-VALUE_OBJECTS.md SS14/RN-23 - "numeracion fiscal correlativa... formato
// dependiente de pais; correlativo sin huecos dentro de su serie". Sin especificacion de
// formato por pais documentada todavia (docs/domain/03-PROCESOS.md linea 217) - se usa un
// correlativo simple por Company, generado en infrastructure/ (INVOICE_NUMBER_GENERATOR_PORT),
// nunca por el cliente. Este VO solo valida la forma, no genera el numero.
const INVOICE_NUMBER_PATTERN = /^INV-\d{8}$/;

export class InvoiceNumber {
  private constructor(private readonly value: string) {}

  static from(raw: string): InvoiceNumber {
    if (!INVOICE_NUMBER_PATTERN.test(raw)) {
      throw new TypeError(`InvoiceNumber invalido (se espera "INV-" + 8 digitos): "${raw}"`);
    }
    return new InvoiceNumber(raw);
  }

  static fromSequence(nextNumber: number): InvoiceNumber {
    return InvoiceNumber.from(`INV-${String(nextNumber).padStart(8, '0')}`);
  }

  toString(): string {
    return this.value;
  }
}
