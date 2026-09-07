import { EntityId, type Money } from '@platform/shared-kernel';

import type { RateUnitValue } from '../value-objects/rate-unit';

export type RateId = EntityId<'Rate'>;

export interface RateProps {
  id: RateId;
  amount: Money;
  unit: RateUnitValue;
  validFrom: Date;
  validTo: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

// Entidad interna de VehicleCategory (docs/model/02-AGGREGATES.md SS9) - append-only, sin
// version propia. validTo=null significa vigencia abierta (docs/persistence/
// 04-COLUMNAS-CONCEPTUALES.md SS9). Sin DateRange de shared-kernel (su contrato exige
// endDate no-nulable, ver docs/persistence/10-DECISIONES.md) - validFrom/validTo son Date
// planos, con overlaps() propio de esta entidad.
export class Rate {
  private constructor(private props: RateProps) {}

  static create(params: {
    amount: Money;
    unit: RateUnitValue;
    validFrom: Date;
    validTo?: Date | null;
  }): Rate {
    const validTo = params.validTo ?? null;
    if (validTo !== null && validTo.getTime() <= params.validFrom.getTime()) {
      throw new TypeError(
        'Rate: validTo debe ser posterior a validFrom (o null, vigencia abierta).',
      );
    }
    const now = new Date();
    return new Rate({
      id: EntityId.generate<'Rate'>(),
      amount: params.amount,
      unit: params.unit,
      validFrom: params.validFrom,
      validTo,
      createdAt: now,
      updatedAt: now,
    });
  }

  static reconstitute(props: RateProps): Rate {
    return new Rate(props);
  }

  get id(): RateId {
    return this.props.id;
  }

  get amount(): Money {
    return this.props.amount;
  }

  get unit(): RateUnitValue {
    return this.props.unit;
  }

  get validFrom(): Date {
    return this.props.validFrom;
  }

  get validTo(): Date | null {
    return this.props.validTo;
  }

  // validTo === null se trata como sin cota superior (Infinity) - misma semantica que la
  // exclusion constraint GiST en Postgres (tsrange con bound NULL = ilimitado).
  overlaps(other: Rate): boolean {
    const thisEnd = this.props.validTo?.getTime() ?? Infinity;
    const otherEnd = other.props.validTo?.getTime() ?? Infinity;
    return this.props.validFrom.getTime() < otherEnd && other.props.validFrom.getTime() < thisEnd;
  }
}
