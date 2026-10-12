// Gap-fill (Reservations, docs/persistence/10-DECISIONES.md #30/#59) - RN-05 ("expira tras
// un tiempo configurable si no se confirma"). Solo fija el valor de la politica esta tanda -
// el job periodico que efectivamente expira Reservation Draft queda fuera de alcance de
// Fase 1 (ver plan de implementacion, mismo gap ya aceptado que el job de
// IdentityDocument.Expired).
export class DraftExpirationPolicy {
  private constructor(private readonly expirationMinutesValue: number) {}

  static from(expirationMinutes: number): DraftExpirationPolicy {
    if (!Number.isFinite(expirationMinutes) || expirationMinutes <= 0) {
      throw new TypeError(
        `DraftExpirationPolicy.expirationMinutes debe ser > 0: ${expirationMinutes}`,
      );
    }
    return new DraftExpirationPolicy(expirationMinutes);
  }

  // Default: 24 horas.
  static default(): DraftExpirationPolicy {
    return new DraftExpirationPolicy(1440);
  }

  get expirationMinutes(): number {
    return this.expirationMinutesValue;
  }
}
