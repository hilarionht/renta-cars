// docs/model/04-VALUE_OBJECTS.md §6, RN-29: "el mantenimiento preventivo se programa segun
// umbrales de kilometraje y/o tiempo transcurrido, definidos por Company". Novena y ultima
// de las 9 politicas documentadas de CompanySettings (docs/persistence/10-DECISIONES.md #30).
// Mismo criterio "applies" que DepositPolicy - una Company puede no tener ningun programa de
// mantenimiento preventivo basado en umbrales todavia. odometerThresholdKm/daysThreshold son
// ambos opcionales ("y/o") pero al menos uno debe estar presente cuando applies es true - un
// umbral que no umbrala nada no es una politica valida. "Umbrales > 0" (docs/model/
// 04-VALUE_OBJECTS.md §6) se valida sobre cualquier campo presente, independiente de applies.
// Sin consumidor real esta tanda - evaluar si un Vehicle cruzo el umbral requiere que Vehicle
// trackee su propio odometer (no lo hace todavia, docs/model/05-DOMAIN_SERVICES.md §candidato
// descartado solo por falta de ese dato, no por diseño) mas un job periodico que la lea -
// mismo tipo de gap explicito que DepositPolicy tuvo antes de Payments (#59).
export interface MaintenanceThresholdPolicyProps {
  applies: boolean;
  odometerThresholdKm?: number;
  daysThreshold?: number;
}

export class MaintenanceThresholdPolicy {
  private constructor(private readonly props: MaintenanceThresholdPolicyProps) {}

  static from(props: MaintenanceThresholdPolicyProps): MaintenanceThresholdPolicy {
    if (props.odometerThresholdKm !== undefined) {
      if (!Number.isFinite(props.odometerThresholdKm) || props.odometerThresholdKm <= 0) {
        throw new TypeError(
          `MaintenanceThresholdPolicy.odometerThresholdKm debe ser mayor a 0: ${props.odometerThresholdKm}`,
        );
      }
    }
    if (props.daysThreshold !== undefined) {
      if (!Number.isFinite(props.daysThreshold) || props.daysThreshold <= 0) {
        throw new TypeError(
          `MaintenanceThresholdPolicy.daysThreshold debe ser mayor a 0: ${props.daysThreshold}`,
        );
      }
    }
    if (
      props.applies &&
      props.odometerThresholdKm === undefined &&
      props.daysThreshold === undefined
    ) {
      throw new TypeError(
        'MaintenanceThresholdPolicy.applies=true requiere al menos un umbral (odometerThresholdKm y/o daysThreshold).',
      );
    }
    return new MaintenanceThresholdPolicy({ ...props });
  }

  static default(): MaintenanceThresholdPolicy {
    return new MaintenanceThresholdPolicy({ applies: false });
  }

  get applies(): boolean {
    return this.props.applies;
  }

  get odometerThresholdKm(): number | undefined {
    return this.props.odometerThresholdKm;
  }

  get daysThreshold(): number | undefined {
    return this.props.daysThreshold;
  }
}
