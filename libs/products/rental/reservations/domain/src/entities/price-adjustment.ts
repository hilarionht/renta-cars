import { EntityId, type Money } from '@platform/shared-kernel';

import type { PriceAdjustmentKindValue } from '../value-objects/price-adjustment-kind';

export type PriceAdjustmentId = EntityId<'PriceAdjustment'>;

export interface PriceAdjustmentProps {
  id: PriceAdjustmentId;
  kind: PriceAdjustmentKindValue;
  amount: Money;
  reason?: string;
  createdAt: Date;
}

// Tratada como entidad de persistencia interna de Reservation (docs/persistence/
// 10-DECISIONES.md #7) SIN reclasificarse como entidad en el modelo de dominio -
// PriceAdjustment sigue siendo Value Object compuesto de PriceBreakdown (docs/model/
// 04-VALUE_OBJECTS.md SS5.2): no tiene identidad de negocio referenciable desde fuera de
// Reservation, pero necesita tabla propia append-only (mismo patron que Charge de Invoice).
// Se le da forma de clase con id solo por consistencia interna del dirty-tracking del
// aggregate root - nunca se expone/compara por identidad fuera de Reservation.
export class PriceAdjustment {
  private constructor(private props: PriceAdjustmentProps) {}

  static create(params: {
    kind: PriceAdjustmentKindValue;
    amount: Money;
    reason?: string;
  }): PriceAdjustment {
    return new PriceAdjustment({
      id: EntityId.generate<'PriceAdjustment'>(),
      kind: params.kind,
      amount: params.amount,
      reason: params.reason,
      createdAt: new Date(),
    });
  }

  static reconstitute(props: PriceAdjustmentProps): PriceAdjustment {
    return new PriceAdjustment(props);
  }

  get id(): PriceAdjustmentId {
    return this.props.id;
  }

  get kind(): PriceAdjustmentKindValue {
    return this.props.kind;
  }

  get amount(): Money {
    return this.props.amount;
  }

  get reason(): string | undefined {
    return this.props.reason;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }
}
