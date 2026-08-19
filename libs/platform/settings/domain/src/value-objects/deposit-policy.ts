// Gap-fill (Reservations, docs/persistence/10-DECISIONES.md #30/#59) - RN-21 ("si aplica,
// monto/mecanismo"). Porcentual sobre el PriceBreakdown de la Reservation, no Money fijo -
// consistente con CancellationPolicy/LateReturnPolicy. Publicada por completitud del
// contrato documentado (09-DEPENDENCIES.md SS2) pero SIN consumidor real esta tanda -
// SecurityDeposit es Commerce/Fase 2, no construido todavia.
export interface DepositPolicyProps {
  applies: boolean;
  percentageOfTotal: number;
}

export class DepositPolicy {
  private constructor(private readonly props: DepositPolicyProps) {}

  static from(props: DepositPolicyProps): DepositPolicy {
    if (
      !Number.isFinite(props.percentageOfTotal) ||
      props.percentageOfTotal < 0 ||
      props.percentageOfTotal > 100
    ) {
      throw new TypeError(
        `DepositPolicy.percentageOfTotal debe estar entre 0 y 100: ${props.percentageOfTotal}`,
      );
    }
    return new DepositPolicy({ ...props });
  }

  static default(): DepositPolicy {
    return new DepositPolicy({ applies: false, percentageOfTotal: 0 });
  }

  get applies(): boolean {
    return this.props.applies;
  }

  get percentageOfTotal(): number {
    return this.props.percentageOfTotal;
  }
}
