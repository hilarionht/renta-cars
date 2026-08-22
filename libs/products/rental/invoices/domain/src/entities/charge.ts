import { EntityId, type Money } from '@platform/shared-kernel';

import type { ChargeKindValue } from '../value-objects/charge-kind';

export type ChargeId = EntityId<'Charge'>;

export interface ChargeProps {
  id: ChargeId;
  kind: ChargeKindValue;
  amount: Money;
  description: string;
  createdAt: Date;
}

// Entidad interna de Invoice (docs/model/02-AGGREGATES.md SS14) - "cada linea de cobro es un
// hecho fiscal individualmente citable", append-only tras la emision (INV-022: sin metodos de
// mutacion, ninguna correccion la edita - una correccion exige void() + una Invoice nueva).
// Mismo esqueleto de clase que PriceAdjustment de Reservation (props inmutables tras create()).
export class Charge {
  private constructor(private props: ChargeProps) {}

  static create(params: { kind: ChargeKindValue; amount: Money; description: string }): Charge {
    return new Charge({
      id: EntityId.generate<'Charge'>(),
      kind: params.kind,
      amount: params.amount,
      description: params.description,
      createdAt: new Date(),
    });
  }

  static reconstitute(props: ChargeProps): Charge {
    return new Charge(props);
  }

  get id(): ChargeId {
    return this.props.id;
  }

  get kind(): ChargeKindValue {
    return this.props.kind;
  }

  get amount(): Money {
    return this.props.amount;
  }

  get description(): string {
    return this.props.description;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }
}
