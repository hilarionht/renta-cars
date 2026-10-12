import { EntityId } from '@platform/shared-kernel';

import type { DamageSeverityValue } from '../value-objects/damage-severity';

export type DamageReportId = EntityId<'DamageReport'>;

export interface DamageReportProps {
  id: DamageReportId;
  inspectionId: string;
  description: string;
  severity: DamageSeverityValue;
  imputableToCustomer: boolean;
  photoFileIds: string[];
  createdAt: Date;
}

// Entidad interna de Reservation (docs/model/02-AGGREGATES.md SS11) - evidencia inmutable
// para cualquier disputa futura (docs/domain/07-EXCEPCIONES.md SS9). Append-only: la
// resolucion comercial derivada vive en Commerce (Fase 2), referenciando este id, nunca
// editando este registro.
export class DamageReport {
  private constructor(private props: DamageReportProps) {}

  static register(params: {
    inspectionId: string;
    description: string;
    severity: DamageSeverityValue;
    imputableToCustomer: boolean;
    photoFileIds: string[];
  }): DamageReport {
    return new DamageReport({
      id: EntityId.generate<'DamageReport'>(),
      inspectionId: params.inspectionId,
      description: params.description,
      severity: params.severity,
      imputableToCustomer: params.imputableToCustomer,
      photoFileIds: params.photoFileIds,
      createdAt: new Date(),
    });
  }

  static reconstitute(props: DamageReportProps): DamageReport {
    return new DamageReport(props);
  }

  get id(): DamageReportId {
    return this.props.id;
  }

  get inspectionId(): string {
    return this.props.inspectionId;
  }

  get description(): string {
    return this.props.description;
  }

  get severity(): DamageSeverityValue {
    return this.props.severity;
  }

  get imputableToCustomer(): boolean {
    return this.props.imputableToCustomer;
  }

  get photoFileIds(): string[] {
    return this.props.photoFileIds;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }
}
