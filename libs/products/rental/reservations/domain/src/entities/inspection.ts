import { EntityId } from '@platform/shared-kernel';

import type { InspectionTypeValue } from '../value-objects/inspection-type';
import type { FuelLevel } from '../value-objects/fuel-level';
import type { Odometer } from '../value-objects/odometer';

export type InspectionId = EntityId<'Inspection'>;

export interface InspectionProps {
  id: InspectionId;
  type: InspectionTypeValue;
  odometer: Odometer;
  fuelLevel: FuelLevel;
  photoFileIds: string[];
  inspectedAt: Date;
  inspectedBy: string;
}

// Entidad interna de Reservation (docs/model/02-AGGREGATES.md SS11) - registro fisico
// inmutable, a lo sumo una CheckOut y una CheckIn por Reservation (unique(reservationId,
// type) a nivel de persistencia). Append-only: sin metodos de mutacion tras register().
export class Inspection {
  private constructor(private props: InspectionProps) {}

  static register(params: {
    type: InspectionTypeValue;
    odometer: Odometer;
    fuelLevel: FuelLevel;
    photoFileIds: string[];
    inspectedBy: string;
  }): Inspection {
    return new Inspection({
      id: EntityId.generate<'Inspection'>(),
      type: params.type,
      odometer: params.odometer,
      fuelLevel: params.fuelLevel,
      photoFileIds: params.photoFileIds,
      inspectedAt: new Date(),
      inspectedBy: params.inspectedBy,
    });
  }

  static reconstitute(props: InspectionProps): Inspection {
    return new Inspection(props);
  }

  get id(): InspectionId {
    return this.props.id;
  }

  get type(): InspectionTypeValue {
    return this.props.type;
  }

  get odometer(): Odometer {
    return this.props.odometer;
  }

  get fuelLevel(): FuelLevel {
    return this.props.fuelLevel;
  }

  get photoFileIds(): string[] {
    return this.props.photoFileIds;
  }

  get inspectedAt(): Date {
    return this.props.inspectedAt;
  }

  get inspectedBy(): string {
    return this.props.inspectedBy;
  }
}
