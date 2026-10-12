// docs/persistence/10-DECISIONES.md #121 (Reminder de reservas) - cuanto tiempo antes del
// check-out programado se envia el recordatorio proactivo al Customer. Mismo patron exacto
// que MinimumBookingLeadTime (este mismo directorio), pero el default NO puede ser 0 (a
// diferencia de "sin restriccion" ahi, 0 aca significaria "recordar justo en el momento del
// check-out", inutil). Valor placeholder explicito, no calibrado - mismo criterio que los
// umbrales de alert-rules.yml (#115), no una decision de negocio a inventar aca.
const DEFAULT_LEAD_TIME_MINUTES = 1440; // 24h, placeholder sin calibrar

export class ReminderLeadTime {
  private constructor(private readonly leadTimeMinutesValue: number) {}

  static from(leadTimeMinutes: number): ReminderLeadTime {
    if (!Number.isFinite(leadTimeMinutes) || leadTimeMinutes <= 0) {
      throw new TypeError(`ReminderLeadTime.leadTimeMinutes debe ser > 0: ${leadTimeMinutes}`);
    }
    return new ReminderLeadTime(leadTimeMinutes);
  }

  static default(): ReminderLeadTime {
    return new ReminderLeadTime(DEFAULT_LEAD_TIME_MINUTES);
  }

  get leadTimeMinutes(): number {
    return this.leadTimeMinutesValue;
  }
}
