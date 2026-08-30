import { EntityId } from '@platform/shared-kernel';

import { AdditionalDriverNotFoundError } from '../errors/additional-driver-not-found.error';
import { IdentityDocumentNotFoundError } from '../errors/identity-document-not-found.error';
import type { AdditionalDriverRegisteredEvent } from '../events/additional-driver-registered.event';
import type { AdditionalDriverRevokedEvent } from '../events/additional-driver-revoked.event';
import type { AdditionalDriverValidatedEvent } from '../events/additional-driver-validated.event';
import type { CustomerBlockedEvent } from '../events/customer-blocked.event';
import type { CustomerDocumentValidatedEvent } from '../events/customer-document-validated.event';
import type { CustomerRegisteredEvent } from '../events/customer-registered.event';
import type { CustomerUnblockedEvent } from '../events/customer-unblocked.event';
import type { CustomerBlockStatusValue } from '../value-objects/customer-block-status';
import type { CustomerStatus } from '../value-objects/customer-status';
import type { CustomerType } from '../value-objects/customer-type';
import type { ContactInfo } from '../value-objects/contact-info';
import type { CustomerName } from '../value-objects/customer-name';
import type { DocumentType } from '../value-objects/document-type';
import type { TaxIdOrDocumentId } from '../value-objects/tax-id-or-document-id';
import { AdditionalDriver } from './additional-driver';
import { IdentityDocument, type IdentityDocumentOwner } from './identity-document';

export type CustomerId = EntityId<'Customer'>;
type CustomerDomainEvent =
  | CustomerRegisteredEvent
  | CustomerDocumentValidatedEvent
  | AdditionalDriverRegisteredEvent
  | AdditionalDriverValidatedEvent
  | AdditionalDriverRevokedEvent
  | CustomerBlockedEvent
  | CustomerUnblockedEvent;

export interface CustomerProps {
  id: CustomerId;
  companyId: string;
  name: CustomerName;
  taxIdOrDocumentId: TaxIdOrDocumentId;
  contactInfo: ContactInfo;
  customerType: CustomerType;
  status: CustomerStatus;
  blockStatus: CustomerBlockStatusValue;
  blockReason?: string;
  createdAt: Date;
  updatedAt: Date;
  version: number;
}

// Aggregate root - docs/model/02-AGGREGATES.md SS10. Primer aggregate de la sesion con
// entidades internas persistidas en tablas propias (IdentityDocument, AdditionalDriver) -
// ver docs/persistence/10-DECISIONES.md sobre el diseño de persistencia con dirty-tracking
// (dirtyDocumentIds/dirtyDriverIds, mismo idioma que domainEvents).
export class Customer {
  private domainEvents: CustomerDomainEvent[] = [];
  private isNewAggregate = false;
  private identityDocuments: IdentityDocument[] = [];
  private additionalDrivers: AdditionalDriver[] = [];
  private dirtyDocumentIds = new Set<string>();
  private dirtyDriverIds = new Set<string>();

  private constructor(private props: CustomerProps) {}

  static create(params: {
    companyId: string;
    name: CustomerName;
    taxIdOrDocumentId: TaxIdOrDocumentId;
    contactInfo: ContactInfo;
    customerType: CustomerType;
  }): Customer {
    const now = new Date();
    const customer = new Customer({
      id: EntityId.generate<'Customer'>(),
      companyId: params.companyId,
      name: params.name,
      taxIdOrDocumentId: params.taxIdOrDocumentId,
      contactInfo: params.contactInfo,
      customerType: params.customerType,
      status: 'Registered',
      blockStatus: 'None',
      createdAt: now,
      updatedAt: now,
      version: 1,
    });
    customer.domainEvents.push({
      eventType: 'CustomerRegistered.v1',
      customerId: customer.props.id.toString(),
      companyId: customer.props.companyId,
      customerType: customer.props.customerType,
    });
    customer.isNewAggregate = true;
    return customer;
  }

  static reconstitute(
    props: CustomerProps,
    identityDocuments: IdentityDocument[],
    additionalDrivers: AdditionalDriver[],
  ): Customer {
    const customer = new Customer(props);
    customer.identityDocuments = identityDocuments;
    customer.additionalDrivers = additionalDrivers;
    return customer;
  }

  get id(): CustomerId {
    return this.props.id;
  }

  get companyId(): string {
    return this.props.companyId;
  }

  get name(): CustomerName {
    return this.props.name;
  }

  get taxIdOrDocumentId(): TaxIdOrDocumentId {
    return this.props.taxIdOrDocumentId;
  }

  get contactInfo(): ContactInfo {
    return this.props.contactInfo;
  }

  get customerType(): CustomerType {
    return this.props.customerType;
  }

  get status(): CustomerStatus {
    return this.props.status;
  }

  get blockStatus(): CustomerBlockStatusValue {
    return this.props.blockStatus;
  }

  get blockReason(): string | undefined {
    return this.props.blockReason;
  }

  get version(): number {
    return this.props.version;
  }

  get isNew(): boolean {
    return this.isNewAggregate;
  }

  get allIdentityDocuments(): IdentityDocument[] {
    return this.identityDocuments;
  }

  get allAdditionalDrivers(): AdditionalDriver[] {
    return this.additionalDrivers;
  }

  markPersisted(): void {
    this.isNewAggregate = false;
  }

  updateDetails(params: { name?: CustomerName; contactInfo?: ContactInfo }): void {
    if (params.name) {
      this.props.name = params.name;
    }
    if (params.contactInfo) {
      this.props.contactInfo = params.contactInfo;
    }
    this.props.updatedAt = new Date();
    this.props.version += 1;
  }

  // Sin evento propio - "Cargar" no esta en el catalogo de eventos (docs/model/
  // 06-DOMAIN_EVENTS.md SS6.2 solo tiene CustomerDocumentValidated.v1, disparado por
  // verifyIdentityDocument, no por la carga).
  uploadIdentityDocument(params: {
    owner: IdentityDocumentOwner;
    documentType: DocumentType;
    fileId: string;
    expiryDate: Date;
    extractedByOcr?: boolean;
  }): IdentityDocument['id'] {
    if (params.owner.type === 'AdditionalDriver' && !this.findDriverOrUndefined(params.owner.id)) {
      throw new AdditionalDriverNotFoundError(params.owner.id);
    }
    const document = IdentityDocument.upload(params);
    this.identityDocuments.push(document);
    this.dirtyDocumentIds.add(document.id.toString());
    this.props.updatedAt = new Date();
    this.props.version += 1;
    return document.id;
  }

  // Efecto lateral: si el documento verificado es del propio Customer (no de un
  // AdditionalDriver) y el estado de documentacion todavia esta en Registered, transiciona
  // a Active (validateDocumentation() de docs/model/08-STATE_MACHINES.md SS6.5) - sin
  // endpoint ni evento propio, mismo criterio que Company.reactivate().
  verifyIdentityDocument(documentId: string): void {
    const document = this.findDocument(documentId);
    const wasAlreadyVerified = document.status === 'Verified';
    document.verify();
    if (wasAlreadyVerified) {
      return;
    }
    this.dirtyDocumentIds.add(documentId);
    this.domainEvents.push({
      eventType: 'CustomerDocumentValidated.v1',
      customerId: this.props.id.toString(),
      documentId,
      documentType: document.documentType,
    });
    if (document.owner.type === 'Customer' && this.props.status === 'Registered') {
      this.props.status = 'Active';
    }
    this.props.updatedAt = new Date();
    this.props.version += 1;
  }

  registerAdditionalDriver(name: string): AdditionalDriver['id'] {
    const driver = AdditionalDriver.register({ customerId: this.props.id.toString(), name });
    this.additionalDrivers.push(driver);
    this.dirtyDriverIds.add(driver.id.toString());
    this.domainEvents.push({
      eventType: 'AdditionalDriverRegistered.v1',
      customerId: this.props.id.toString(),
      driverId: driver.id.toString(),
    });
    this.props.updatedAt = new Date();
    this.props.version += 1;
    return driver.id;
  }

  validateAdditionalDriverLicense(driverId: string): void {
    const driver = this.findDriver(driverId);
    const wasAlreadyValidated = driver.status === 'Validated';
    const license = this.identityDocuments.find(
      (document) => document.owner.type === 'AdditionalDriver' && document.owner.id === driverId,
    );
    driver.validateLicense(license);
    if (wasAlreadyValidated) {
      return;
    }
    this.dirtyDriverIds.add(driverId);
    this.domainEvents.push({
      eventType: 'AdditionalDriverValidated.v1',
      customerId: this.props.id.toString(),
      driverId,
    });
    this.props.updatedAt = new Date();
    this.props.version += 1;
  }

  revokeAdditionalDriver(driverId: string): void {
    const driver = this.findDriver(driverId);
    if (driver.status === 'Revoked') {
      return;
    }
    driver.revoke();
    this.dirtyDriverIds.add(driverId);
    this.domainEvents.push({
      eventType: 'AdditionalDriverRevoked.v1',
      customerId: this.props.id.toString(),
      driverId,
    });
    this.props.updatedAt = new Date();
    this.props.version += 1;
  }

  block(reason: string): void {
    if (this.props.blockStatus === 'Blocked') {
      return;
    }
    this.props.blockStatus = 'Blocked';
    this.props.blockReason = reason;
    this.props.updatedAt = new Date();
    this.props.version += 1;
    this.domainEvents.push({
      eventType: 'CustomerBlocked.v1',
      customerId: this.props.id.toString(),
      reason,
    });
  }

  unblock(unblockedBy: string): void {
    if (this.props.blockStatus === 'None') {
      return;
    }
    this.props.blockStatus = 'None';
    this.props.blockReason = undefined;
    this.props.updatedAt = new Date();
    this.props.version += 1;
    this.domainEvents.push({
      eventType: 'CustomerUnblocked.v1',
      customerId: this.props.id.toString(),
      unblockedBy,
    });
  }

  // Predicado forward-looking, lenguaje exacto de INV-104 ("documentacion vigente, no
  // bloqueado") - Reservation (Fase 1, no construido todavia) lo consultara via
  // CustomerLookupPort cuando exista.
  isEligibleForConfirmation(): boolean {
    if (this.props.blockStatus === 'Blocked' || this.props.status !== 'Active') {
      return false;
    }
    const ownDocument = this.identityDocuments.find(
      (document) => document.owner.type === 'Customer',
    );
    return ownDocument ? ownDocument.isCurrentlyValid() : false;
  }

  pullDomainEvents(): CustomerDomainEvent[] {
    const events = this.domainEvents;
    this.domainEvents = [];
    return events;
  }

  pullDirtyIdentityDocuments(): IdentityDocument[] {
    const dirty = this.identityDocuments.filter((document) =>
      this.dirtyDocumentIds.has(document.id.toString()),
    );
    this.dirtyDocumentIds.clear();
    return dirty;
  }

  pullDirtyAdditionalDrivers(): AdditionalDriver[] {
    const dirty = this.additionalDrivers.filter((driver) =>
      this.dirtyDriverIds.has(driver.id.toString()),
    );
    this.dirtyDriverIds.clear();
    return dirty;
  }

  private findDocument(documentId: string): IdentityDocument {
    const document = this.identityDocuments.find((d) => d.id.toString() === documentId);
    if (!document) {
      throw new IdentityDocumentNotFoundError(documentId);
    }
    return document;
  }

  private findDriver(driverId: string): AdditionalDriver {
    const driver = this.findDriverOrUndefined(driverId);
    if (!driver) {
      throw new AdditionalDriverNotFoundError(driverId);
    }
    return driver;
  }

  private findDriverOrUndefined(driverId: string): AdditionalDriver | undefined {
    return this.additionalDrivers.find((d) => d.id.toString() === driverId);
  }
}
