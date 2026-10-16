import { InvalidValueError } from '@platform/shared-kernel';

// Gap-fill (Reservations, docs/persistence/10-DECISIONES.md #30/#59) - RN-26 no fija una
// forma concreta ("plazos sin penalidad, porcentaje de penalidad segun anticipacion"),
// modelado como tramos ordenados por antelacion minima. Porcentual, no Money - el monto real
// se resuelve en Reservation.PricingService contra la tarifa de esa reserva especifica; una
// politica a nivel de Company no puede fijar un monto en una moneda concreta.
export interface CancellationPolicyTier {
  minHoursBeforeStart: number;
  penaltyPercentage: number;
}

export class CancellationPolicy {
  private constructor(private readonly policyTiers: CancellationPolicyTier[]) {}

  static from(tiers: CancellationPolicyTier[]): CancellationPolicy {
    if (tiers.length === 0) {
      throw new InvalidValueError('CancellationPolicy requiere al menos un tramo.');
    }
    for (const tier of tiers) {
      if (!Number.isFinite(tier.minHoursBeforeStart) || tier.minHoursBeforeStart < 0) {
        throw new InvalidValueError(
          `CancellationPolicy.minHoursBeforeStart debe ser >= 0: ${tier.minHoursBeforeStart}`,
        );
      }
      if (
        !Number.isFinite(tier.penaltyPercentage) ||
        tier.penaltyPercentage < 0 ||
        tier.penaltyPercentage > 100
      ) {
        throw new InvalidValueError(
          `CancellationPolicy.penaltyPercentage debe estar entre 0 y 100: ${tier.penaltyPercentage}`,
        );
      }
    }
    // #140 (decision del usuario): coherencia. Sin horas repetidas (el tramo aplicable seria
    // ambiguo) y, a mas anticipacion, multa menor o igual (cancelar antes nunca cuesta mas).
    const sorted = [...tiers].sort((a, b) => a.minHoursBeforeStart - b.minHoursBeforeStart);
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].minHoursBeforeStart === sorted[i - 1].minHoursBeforeStart) {
        throw new InvalidValueError(
          `CancellationPolicy tiene dos tramos con ${sorted[i].minHoursBeforeStart} horas.`,
        );
      }
      if (sorted[i].penaltyPercentage > sorted[i - 1].penaltyPercentage) {
        throw new InvalidValueError(
          'CancellationPolicy: a mas anticipacion la multa tiene que ser menor o igual.',
        );
      }
    }
    return new CancellationPolicy(sorted);
  }

  // #140: carga desde la base sin validar. Las reglas nuevas aplican a lo que entra; una politica
  // guardada antes (p. ej. con tramos repetidos) no puede trabar la configuracion de la company.
  static reconstitute(tiers: CancellationPolicyTier[]): CancellationPolicy {
    return new CancellationPolicy([...tiers]);
  }

  // Default neutral: cancelacion siempre libre de penalidad - RN-26 es Importante, no
  // Critica, y no hay base documental para curar un tramo de penalidad de arranque.
  static default(): CancellationPolicy {
    return new CancellationPolicy([{ minHoursBeforeStart: 0, penaltyPercentage: 0 }]);
  }

  get tiers(): CancellationPolicyTier[] {
    return this.policyTiers;
  }

  // Tramo aplicable: el de mayor minHoursBeforeStart que la antelacion real todavia satisface.
  penaltyPercentageFor(hoursBeforeStart: number): number {
    const applicable = [...this.policyTiers]
      .filter((tier) => hoursBeforeStart >= tier.minHoursBeforeStart)
      .sort((a, b) => b.minHoursBeforeStart - a.minHoursBeforeStart)[0];
    return applicable?.penaltyPercentage ?? 100;
  }
}
