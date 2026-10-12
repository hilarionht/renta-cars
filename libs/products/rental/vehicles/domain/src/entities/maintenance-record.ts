import { EntityId } from '@platform/shared-kernel';

import { MaintenanceRecordInvalidStateTransitionError } from '../errors/maintenance-record-invalid-state-transition.error';
import type { MaintenanceStatusValue } from '../value-objects/maintenance-status';
import type { MaintenanceTypeValue } from '../value-objects/maintenance-type';

export type MaintenanceRecordId = EntityId<'MaintenanceRecord'>;

export interface MaintenanceRecordProps {
  id: MaintenanceRecordId;
  type: MaintenanceTypeValue;
  status: MaintenanceStatusValue;
  scheduledStart: Date;
  scheduledEnd: Date;
  fitForService?: boolean;
  responsibleUserId?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Entidad interna de Vehicle (docs/model/02-AGGREGATES.md SS8) - append-only, sin version
// propia (protegida por la version de Vehicle). docs/model/08-STATE_MACHINES.md SS5:
// Scheduled -> InProgress -> Completed, "Completed" es terminal (nunca se reabre, un
// resultado fitForService=false crea un MaintenanceRecord nuevo en Scheduled, ver
// Vehicle.completeMaintenance()).
export class MaintenanceRecord {
  private constructor(private props: MaintenanceRecordProps) {}

  static schedule(params: {
    type: MaintenanceTypeValue;
    scheduledStart: Date;
    scheduledEnd: Date;
    responsibleUserId?: string;
  }): MaintenanceRecord {
    if (params.scheduledEnd.getTime() <= params.scheduledStart.getTime()) {
      throw new TypeError('MaintenanceRecord: scheduledEnd debe ser posterior a scheduledStart.');
    }
    const now = new Date();
    return new MaintenanceRecord({
      id: EntityId.generate<'MaintenanceRecord'>(),
      type: params.type,
      status: 'Scheduled',
      scheduledStart: params.scheduledStart,
      scheduledEnd: params.scheduledEnd,
      responsibleUserId: params.responsibleUserId,
      createdAt: now,
      updatedAt: now,
    });
  }

  static reconstitute(props: MaintenanceRecordProps): MaintenanceRecord {
    return new MaintenanceRecord(props);
  }

  get id(): MaintenanceRecordId {
    return this.props.id;
  }

  get type(): MaintenanceTypeValue {
    return this.props.type;
  }

  get status(): MaintenanceStatusValue {
    return this.props.status;
  }

  get scheduledStart(): Date {
    return this.props.scheduledStart;
  }

  get scheduledEnd(): Date {
    return this.props.scheduledEnd;
  }

  get fitForService(): boolean | undefined {
    return this.props.fitForService;
  }

  get responsibleUserId(): string | undefined {
    return this.props.responsibleUserId;
  }

  start(): void {
    if (this.props.status !== 'Scheduled') {
      throw new MaintenanceRecordInvalidStateTransitionError(
        this.props.id.toString(),
        this.props.status,
        'start',
      );
    }
    this.props.status = 'InProgress';
    this.props.updatedAt = new Date();
  }

  complete(fitForService: boolean): void {
    if (this.props.status !== 'InProgress') {
      throw new MaintenanceRecordInvalidStateTransitionError(
        this.props.id.toString(),
        this.props.status,
        'complete',
      );
    }
    this.props.status = 'Completed';
    this.props.fitForService = fitForService;
    this.props.updatedAt = new Date();
  }
}
