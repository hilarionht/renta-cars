// Gap-fill (Reservations, docs/persistence/10-DECISIONES.md #30/#59) - RN-15/RN-16 piden
// "tabla de tarifas por hora/dia de exceso" + "tolerancia de gracia", simplificado a una
// tasa plana por hora de exceso (mismo pragmatismo ya usado para LicensePlate/RateUnit en
// Vehicles: forma minima esta tanda, sin tabla escalonada real). Porcentual sobre la tarifa
// diaria de la Reservation, no Money.
export interface LateReturnPolicyProps {
  graceMinutes: number;
  penaltyPercentagePerHour: number;
}

export class LateReturnPolicy {
  private constructor(private readonly props: LateReturnPolicyProps) {}

  static from(props: LateReturnPolicyProps): LateReturnPolicy {
    if (!Number.isFinite(props.graceMinutes) || props.graceMinutes < 0) {
      throw new TypeError(`LateReturnPolicy.graceMinutes debe ser >= 0: ${props.graceMinutes}`);
    }
    if (!Number.isFinite(props.penaltyPercentagePerHour) || props.penaltyPercentagePerHour < 0) {
      throw new TypeError(
        `LateReturnPolicy.penaltyPercentagePerHour debe ser >= 0: ${props.penaltyPercentagePerHour}`,
      );
    }
    return new LateReturnPolicy({ ...props });
  }

  // Default: 30 min de gracia (rango tipico citado por RN-16 "p. ej. 30-60 minutos"), 10%
  // de la tarifa diaria por cada hora de exceso mas alla de la gracia.
  static default(): LateReturnPolicy {
    return new LateReturnPolicy({ graceMinutes: 30, penaltyPercentagePerHour: 10 });
  }

  get graceMinutes(): number {
    return this.props.graceMinutes;
  }

  get penaltyPercentagePerHour(): number {
    return this.props.penaltyPercentagePerHour;
  }
}
