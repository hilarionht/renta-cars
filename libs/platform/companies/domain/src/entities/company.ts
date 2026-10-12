import { EntityId } from '@platform/shared-kernel';

import type { CompanyRegisteredEvent } from '../events/company-registered.event';
import type { CompanySuspendedEvent } from '../events/company-suspended.event';
import type { BillingContact } from '../value-objects/billing-contact';
import type { CompanyStatus } from '../value-objects/company-status';
import type { LegalName } from '../value-objects/legal-name';
import type { TaxId } from '../value-objects/tax-id';

export type CompanyId = EntityId<'Company'>;
type CompanyDomainEvent = CompanyRegisteredEvent | CompanySuspendedEvent;

export interface CompanyProps {
  id: CompanyId;
  legalName: LegalName;
  taxId: TaxId;
  billingContact: BillingContact;
  status: CompanyStatus;
  createdAt: Date;
  updatedAt: Date;
  version: number;
}

// Aggregate root, raiz de todo el modelo multi-tenant - docs/model/02-AGGREGATES.md SS4. No
// contiene Branch/CompanySettings/User (agregados propios, referenciados por companyId).
export class Company {
  private domainEvents: CompanyDomainEvent[] = [];
  private isNewAggregate = false;

  private constructor(private props: CompanyProps) {}

  static create(params: {
    legalName: LegalName;
    taxId: TaxId;
    billingContact: BillingContact;
  }): Company {
    const now = new Date();
    const company = new Company({
      id: EntityId.generate<'Company'>(),
      legalName: params.legalName,
      taxId: params.taxId,
      billingContact: params.billingContact,
      status: 'Active',
      createdAt: now,
      updatedAt: now,
      version: 1,
    });

    company.domainEvents.push({
      eventType: 'CompanyRegistered.v1',
      companyId: company.props.id.toString(),
      legalName: company.props.legalName.toString(),
      taxId: company.props.taxId.toString(),
    });
    company.isNewAggregate = true;

    return company;
  }

  static reconstitute(props: CompanyProps): Company {
    return new Company(props);
  }

  get id(): CompanyId {
    return this.props.id;
  }

  get legalName(): LegalName {
    return this.props.legalName;
  }

  get taxId(): TaxId {
    return this.props.taxId;
  }

  get billingContact(): BillingContact {
    return this.props.billingContact;
  }

  get status(): CompanyStatus {
    return this.props.status;
  }

  get version(): number {
    return this.props.version;
  }

  get isNew(): boolean {
    return this.isNewAggregate;
  }

  markPersisted(): void {
    this.isNewAggregate = false;
  }

  updateDetails(params: { legalName?: LegalName; billingContact?: BillingContact }): void {
    if (params.legalName) {
      this.props.legalName = params.legalName;
    }
    if (params.billingContact) {
      this.props.billingContact = params.billingContact;
    }
    this.props.updatedAt = new Date();
    this.props.version += 1;
  }

  // Solo un rol de super-administracion de Plataforma (docs/model/02-AGGREGATES.md SS4) -
  // ese mecanismo cross-tenant no existe todavia, asi que este metodo no se expone via HTTP
  // en esta tanda (gap aceptado y documentado, ver plan de implementacion).
  suspend(reason: string): void {
    if (this.props.status === 'Suspended') {
      return;
    }
    this.props.status = 'Suspended';
    this.props.updatedAt = new Date();
    this.props.version += 1;
    this.domainEvents.push({
      eventType: 'CompanySuspended.v1',
      companyId: this.props.id.toString(),
      reason,
    });
  }

  // Sin evento propio - el catalogo (docs/model/06-DOMAIN_EVENTS.md SS4) solo lista
  // CompanyRegistered.v1/CompanySuspended.v1, mismo criterio ya usado para User.reactivate().
  reactivate(): void {
    this.props.status = 'Active';
    this.props.updatedAt = new Date();
    this.props.version += 1;
  }

  pullDomainEvents(): CompanyDomainEvent[] {
    const events = this.domainEvents;
    this.domainEvents = [];
    return events;
  }
}
