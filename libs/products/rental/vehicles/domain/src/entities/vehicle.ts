import { EntityId } from '@platform/shared-kernel';

import { MaintenanceRecordNotFoundError } from '../errors/maintenance-record-not-found.error';
import { VehicleDocumentNotFoundError } from '../errors/vehicle-document-not-found.error';
import { VehicleDocumentationIncompleteError } from '../errors/vehicle-documentation-incomplete.error';
import { VehicleInvalidStateTransitionError } from '../errors/vehicle-invalid-state-transition.error';
import type { MaintenanceCompletedEvent } from '../events/maintenance-completed.event';
import type { MaintenanceScheduledEvent } from '../events/maintenance-scheduled.event';
import type { VehicleDocumentationLoadedEvent } from '../events/vehicle-documentation-loaded.event';
import type { VehicleEnabledEvent } from '../events/vehicle-enabled.event';
import type { VehicleRegisteredEvent } from '../events/vehicle-registered.event';
import type { VehicleStatusChangedEvent } from '../events/vehicle-status-changed.event';
import type { DamageSeverityValue } from '../value-objects/damage-severity';
import type { LicensePlate } from '../value-objects/license-plate';
import type { MaintenanceTypeValue } from '../value-objects/maintenance-type';
import type { VehicleDocumentTypeValue } from '../value-objects/vehicle-document-type';
import type { VehicleStatusValue } from '../value-objects/vehicle-status';
import type { VIN } from '../value-objects/vin';
import { MaintenanceRecord } from './maintenance-record';
import { VehicleDocument } from './vehicle-document';

export type VehicleId = EntityId<'Vehicle'>;
type VehicleDomainEvent =
  | VehicleRegisteredEvent
  | VehicleDocumentationLoadedEvent
  | VehicleEnabledEvent
  | VehicleStatusChangedEvent
  | MaintenanceScheduledEvent
  | MaintenanceCompletedEvent;

// Ventana por defecto para el MaintenanceRecord de re-intento creado cuando
// completeMaintenance(fitForService=false) - gap-fill pragmatico, sin instruccion de
// negocio sobre cual deberia ser (ver plan de implementacion).
const RETRY_MAINTENANCE_WINDOW_DAYS = 7;

export interface VehicleProps {
  id: VehicleId;
  companyId: string;
  branchId: string;
  vehicleCategoryId: string;
  licensePlate: LicensePlate;
  vin: VIN;
  status: VehicleStatusValue;
  createdAt: Date;
  updatedAt: Date;
  version: number;
}

// Aggregate root (docs/model/02-AGGREGATES.md SS8) - entidades internas en tablas propias
// (VehicleDocument, MaintenanceRecord), mismo diseno de persistencia con dirty-tracking que
// Customer (docs/persistence/10-DECISIONES.md #36). Toda mutacion, incluidas las que solo
// tocan un hijo, bumpea version/updatedAt del root (bug real corregido en Customers,
// docs/persistence/10-DECISIONES.md #46) - no repetido aca.
export class Vehicle {
  private domainEvents: VehicleDomainEvent[] = [];
  private isNewAggregate = false;
  private vehicleDocuments: VehicleDocument[] = [];
  private maintenanceRecords: MaintenanceRecord[] = [];
  private dirtyDocumentIds = new Set<string>();
  private dirtyMaintenanceIds = new Set<string>();

  private constructor(private props: VehicleProps) {}

  static create(params: {
    companyId: string;
    branchId: string;
    vehicleCategoryId: string;
    licensePlate: LicensePlate;
    vin: VIN;
  }): Vehicle {
    const now = new Date();
    const vehicle = new Vehicle({
      id: EntityId.generate<'Vehicle'>(),
      companyId: params.companyId,
      branchId: params.branchId,
      vehicleCategoryId: params.vehicleCategoryId,
      licensePlate: params.licensePlate,
      vin: params.vin,
      status: 'Registered',
      createdAt: now,
      updatedAt: now,
      version: 1,
    });
    vehicle.domainEvents.push({
      eventType: 'VehicleRegistered.v1',
      vehicleId: vehicle.props.id.toString(),
      branchId: vehicle.props.branchId,
      licensePlate: vehicle.props.licensePlate.toString(),
      vin: vehicle.props.vin.toString(),
      categoryId: vehicle.props.vehicleCategoryId,
    });
    vehicle.isNewAggregate = true;
    return vehicle;
  }

  static reconstitute(
    props: VehicleProps,
    vehicleDocuments: VehicleDocument[],
    maintenanceRecords: MaintenanceRecord[],
  ): Vehicle {
    const vehicle = new Vehicle(props);
    vehicle.vehicleDocuments = vehicleDocuments;
    vehicle.maintenanceRecords = maintenanceRecords;
    return vehicle;
  }

  get id(): VehicleId {
    return this.props.id;
  }

  get companyId(): string {
    return this.props.companyId;
  }

  get branchId(): string {
    return this.props.branchId;
  }

  get vehicleCategoryId(): string {
    return this.props.vehicleCategoryId;
  }

  get licensePlate(): LicensePlate {
    return this.props.licensePlate;
  }

  get vin(): VIN {
    return this.props.vin;
  }

  get status(): VehicleStatusValue {
    return this.props.status;
  }

  get version(): number {
    return this.props.version;
  }

  get isNew(): boolean {
    return this.isNewAggregate;
  }

  get allVehicleDocuments(): VehicleDocument[] {
    return this.vehicleDocuments;
  }

  get allMaintenanceRecords(): MaintenanceRecord[] {
    return this.maintenanceRecords;
  }

  markPersisted(): void {
    this.isNewAggregate = false;
  }

  uploadDocument(params: {
    documentType: VehicleDocumentTypeValue;
    fileId: string;
    expiryDate: Date;
  }): VehicleDocument['id'] {
    const document = VehicleDocument.upload(params);
    this.vehicleDocuments.push(document);
    this.dirtyDocumentIds.add(document.id.toString());
    this.props.updatedAt = new Date();
    this.props.version += 1;
    this.domainEvents.push({
      eventType: 'VehicleDocumentationLoaded.v1',
      vehicleId: this.props.id.toString(),
      documentId: document.id.toString(),
      documentType: document.documentType,
      validUntil: document.expiryDate.toISOString(),
    });
    return document.id;
  }

  verifyDocument(documentId: string): void {
    const document = this.findDocument(documentId);
    const wasAlreadyVerified = document.status === 'Verified';
    document.verify();
    if (wasAlreadyVerified) {
      return;
    }
    this.dirtyDocumentIds.add(documentId);
    this.props.updatedAt = new Date();
    this.props.version += 1;
  }

  // INV-007: requiere al menos un VehicleDocument Verified (docs/model/07-INVARIANTS.md,
  // RN-27) - interpretado como "de cualquier tipo", el catalogo de tipos obligatorios es
  // dependiente de pais/configurable y no hay politica de CompanySettings que lo respalde
  // esta tanda (ver plan de implementacion).
  enable(): void {
    if (this.props.status !== 'Registered') {
      throw new VehicleInvalidStateTransitionError(
        this.props.id.toString(),
        this.props.status,
        'enable',
      );
    }
    const hasVerifiedDocument = this.vehicleDocuments.some(
      (document) => document.status === 'Verified',
    );
    if (!hasVerifiedDocument) {
      throw new VehicleDocumentationIncompleteError(this.props.id.toString());
    }
    this.props.status = 'Available';
    this.props.updatedAt = new Date();
    this.props.version += 1;
    this.domainEvents.push({ eventType: 'VehicleEnabled.v1', vehicleId: this.props.id.toString() });
  }

  scheduleMaintenance(params: {
    type: MaintenanceTypeValue;
    scheduledStart: Date;
    scheduledEnd: Date;
    responsibleUserId?: string;
  }): MaintenanceRecord['id'] {
    if (this.props.status !== 'Available' && this.props.status !== 'OutOfService') {
      throw new VehicleInvalidStateTransitionError(
        this.props.id.toString(),
        this.props.status,
        'scheduleMaintenance',
      );
    }
    const record = MaintenanceRecord.schedule(params);
    this.maintenanceRecords.push(record);
    this.dirtyMaintenanceIds.add(record.id.toString());
    // El precondition de arriba garantiza status en {Available, OutOfService} - la
    // transicion a Maintenance ocurre siempre, sin necesidad de comparar antes/despues.
    const previousStatus = this.props.status;
    this.props.status = 'Maintenance';
    this.props.updatedAt = new Date();
    this.props.version += 1;
    this.domainEvents.push({
      eventType: 'MaintenanceScheduled.v1',
      vehicleId: this.props.id.toString(),
      maintenanceId: record.id.toString(),
      type: record.type,
      window: {
        start: record.scheduledStart.toISOString(),
        end: record.scheduledEnd.toISOString(),
      },
    });
    this.domainEvents.push({
      eventType: 'VehicleStatusChanged.v1',
      vehicleId: this.props.id.toString(),
      previousStatus,
      newStatus: this.props.status,
    });
    return record.id;
  }

  startMaintenance(maintenanceId: string): void {
    const record = this.findMaintenanceRecord(maintenanceId);
    record.start();
    this.dirtyMaintenanceIds.add(maintenanceId);
    this.props.updatedAt = new Date();
    this.props.version += 1;
  }

  completeMaintenance(maintenanceId: string, fitForService: boolean): void {
    const record = this.findMaintenanceRecord(maintenanceId);
    record.complete(fitForService);
    this.dirtyMaintenanceIds.add(maintenanceId);

    const previousStatus = this.props.status;
    if (fitForService) {
      this.props.status = 'Available';
    } else {
      const retryStart = new Date();
      const retryEnd = new Date(
        retryStart.getTime() + RETRY_MAINTENANCE_WINDOW_DAYS * 24 * 60 * 60 * 1000,
      );
      const retryRecord = MaintenanceRecord.schedule({
        type: record.type,
        scheduledStart: retryStart,
        scheduledEnd: retryEnd,
        responsibleUserId: record.responsibleUserId,
      });
      this.maintenanceRecords.push(retryRecord);
      this.dirtyMaintenanceIds.add(retryRecord.id.toString());
    }
    this.props.updatedAt = new Date();
    this.props.version += 1;
    this.domainEvents.push({
      eventType: 'MaintenanceCompleted.v1',
      vehicleId: this.props.id.toString(),
      maintenanceId,
      fitForService,
    });
    if (previousStatus !== this.props.status) {
      this.domainEvents.push({
        eventType: 'VehicleStatusChanged.v1',
        vehicleId: this.props.id.toString(),
        previousStatus,
        newStatus: this.props.status,
      });
    }
  }

  reportDamage(severity: DamageSeverityValue, reason?: string): void {
    if (this.props.status !== 'Available') {
      throw new VehicleInvalidStateTransitionError(
        this.props.id.toString(),
        this.props.status,
        'reportDamage',
      );
    }
    const previousStatus = this.props.status;
    this.props.status = severity === 'Minor' ? 'Maintenance' : 'OutOfService';
    this.props.updatedAt = new Date();
    this.props.version += 1;
    this.domainEvents.push({
      eventType: 'VehicleStatusChanged.v1',
      vehicleId: this.props.id.toString(),
      previousStatus,
      newStatus: this.props.status,
      reason,
    });
  }

  markOutOfService(reason?: string): void {
    if (this.props.status !== 'Available') {
      throw new VehicleInvalidStateTransitionError(
        this.props.id.toString(),
        this.props.status,
        'markOutOfService',
      );
    }
    const previousStatus = this.props.status;
    this.props.status = 'OutOfService';
    this.props.updatedAt = new Date();
    this.props.version += 1;
    this.domainEvents.push({
      eventType: 'VehicleStatusChanged.v1',
      vehicleId: this.props.id.toString(),
      previousStatus,
      newStatus: this.props.status,
      reason,
    });
  }

  pullDomainEvents(): VehicleDomainEvent[] {
    const events = this.domainEvents;
    this.domainEvents = [];
    return events;
  }

  pullDirtyVehicleDocuments(): VehicleDocument[] {
    const dirty = this.vehicleDocuments.filter((document) =>
      this.dirtyDocumentIds.has(document.id.toString()),
    );
    this.dirtyDocumentIds.clear();
    return dirty;
  }

  pullDirtyMaintenanceRecords(): MaintenanceRecord[] {
    const dirty = this.maintenanceRecords.filter((record) =>
      this.dirtyMaintenanceIds.has(record.id.toString()),
    );
    this.dirtyMaintenanceIds.clear();
    return dirty;
  }

  private findDocument(documentId: string): VehicleDocument {
    const document = this.vehicleDocuments.find((d) => d.id.toString() === documentId);
    if (!document) {
      throw new VehicleDocumentNotFoundError(documentId);
    }
    return document;
  }

  private findMaintenanceRecord(maintenanceId: string): MaintenanceRecord {
    const record = this.maintenanceRecords.find((r) => r.id.toString() === maintenanceId);
    if (!record) {
      throw new MaintenanceRecordNotFoundError(maintenanceId);
    }
    return record;
  }
}
