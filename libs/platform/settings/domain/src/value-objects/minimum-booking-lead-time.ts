// Gap-fill (Reservations, docs/persistence/10-DECISIONES.md #30/#59) - RN-06 ("no permitir
// reservar para 'dentro de 10 minutos'"). Default 0 = sin restriccion, RN-06 es Opcional.
export class MinimumBookingLeadTime {
  private constructor(private readonly leadTimeMinutesValue: number) {}

  static from(leadTimeMinutes: number): MinimumBookingLeadTime {
    if (!Number.isFinite(leadTimeMinutes) || leadTimeMinutes < 0) {
      throw new TypeError(
        `MinimumBookingLeadTime.leadTimeMinutes debe ser >= 0: ${leadTimeMinutes}`,
      );
    }
    return new MinimumBookingLeadTime(leadTimeMinutes);
  }

  static default(): MinimumBookingLeadTime {
    return new MinimumBookingLeadTime(0);
  }

  get leadTimeMinutes(): number {
    return this.leadTimeMinutesValue;
  }
}
