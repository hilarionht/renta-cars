import { EntityId, Money } from '@platform/shared-kernel';

import { Charge } from './charge';
import { InvoiceInvalidStateTransitionError } from '../errors/invoice-invalid-state-transition.error';
import type { InvoiceIssuedEvent } from '../events/invoice-issued.event';
import type { InvoiceVoidedEvent } from '../events/invoice-voided.event';
import type { ChargeKindValue } from '../value-objects/charge-kind';
import type { InvoiceNumber } from '../value-objects/invoice-number';
import type { InvoiceStatusValue } from '../value-objects/invoice-status';
import type { TaxDetails } from '../value-objects/tax-details';

export type InvoiceId = EntityId<'Invoice'>;
type InvoiceDomainEvent = InvoiceIssuedEvent | InvoiceVoidedEvent;

export interface InvoiceProps {
  id: InvoiceId;
  // Infraestructura de aislamiento multi-tenant (RLS) - nunca leido por ninguna regla de
  // negocio de este aggregate (docs/persistence/01-SCHEMAS.md SS4.3, 10-DECISIONES.md #1).
  companyId: string;
  reservationId: string;
  customerId: string;
  invoiceNumber: string;
  status: InvoiceStatusValue;
  taxDetails: TaxDetails;
  voidReason?: string;
  createdAt: Date;
  updatedAt: Date;
  version: number;
}

// Aggregate root (docs/model/02-AGGREGATES.md SS14) - Charge es entidad interna, pero a
// diferencia de Reservation (que acumula hijos incrementalmente a lo largo de muchos
// comandos, con dirty-tracking) Invoice crea TODOS sus Charge de una sola vez en issue() y
// nunca los vuelve a tocar (INV-022, sin comando de edicion) - no necesita dirty-tracking.
export class Invoice {
  private domainEvents: InvoiceDomainEvent[] = [];
  private isNewAggregate = false;
  private chargeList: Charge[] = [];

  private constructor(private props: InvoiceProps) {}

  static issue(params: {
    companyId: string;
    reservationId: string;
    customerId: string;
    invoiceNumber: InvoiceNumber;
    taxDetails: TaxDetails;
    charges: { kind: ChargeKindValue; amount: Money; description: string }[];
  }): Invoice {
    if (params.charges.length === 0) {
      throw new TypeError('Invoice.issue() requiere al menos un Charge.');
    }
    const now = new Date();
    const invoice = new Invoice({
      id: EntityId.generate<'Invoice'>(),
      companyId: params.companyId,
      reservationId: params.reservationId,
      customerId: params.customerId,
      invoiceNumber: params.invoiceNumber.toString(),
      status: 'Issued',
      taxDetails: params.taxDetails,
      createdAt: now,
      updatedAt: now,
      version: 1,
    });
    invoice.chargeList = params.charges.map((charge) =>
      Charge.create({ kind: charge.kind, amount: charge.amount, description: charge.description }),
    );

    const total = invoice.total;
    invoice.domainEvents.push({
      eventType: 'InvoiceIssued.v1',
      invoiceId: invoice.props.id.toString(),
      reservationId: invoice.props.reservationId,
      customerId: invoice.props.customerId,
      invoiceNumber: invoice.props.invoiceNumber,
      charges: invoice.chargeList.map((charge) => ({
        kind: charge.kind,
        amountMinorUnits: charge.amount.minorUnits,
        currency: charge.amount.currencyCode,
        description: charge.description,
      })),
      total: { minorUnits: total.minorUnits, currency: total.currencyCode },
    });
    invoice.isNewAggregate = true;
    return invoice;
  }

  static reconstitute(props: InvoiceProps, charges: Charge[]): Invoice {
    const invoice = new Invoice(props);
    invoice.chargeList = charges;
    return invoice;
  }

  // INV-023: Voided es terminal, nunca vuelve a Issued (una correccion crea una Invoice
  // nueva, esta misma queda anulada para siempre).
  void(reason: string): void {
    if (this.props.status !== 'Issued') {
      throw new InvoiceInvalidStateTransitionError(
        this.props.id.toString(),
        this.props.status,
        'void',
      );
    }
    this.props.status = 'Voided';
    this.props.voidReason = reason;
    this.props.updatedAt = new Date();
    this.props.version += 1;
    this.domainEvents.push({
      eventType: 'InvoiceVoided.v1',
      invoiceId: this.props.id.toString(),
      reason,
    });
  }

  // Unica fuente del total facturado - nunca un campo editable independiente
  // (docs/model/02-AGGREGATES.md SS14).
  get total(): Money {
    return this.chargeList.reduce(
      (sum, charge) => sum.add(charge.amount),
      Money.from(0, this.chargeList[0].amount.currencyCode),
    );
  }

  get id(): InvoiceId {
    return this.props.id;
  }

  get companyId(): string {
    return this.props.companyId;
  }

  get reservationId(): string {
    return this.props.reservationId;
  }

  get customerId(): string {
    return this.props.customerId;
  }

  get invoiceNumber(): string {
    return this.props.invoiceNumber;
  }

  get status(): InvoiceStatusValue {
    return this.props.status;
  }

  get taxDetails(): TaxDetails {
    return this.props.taxDetails;
  }

  get voidReason(): string | undefined {
    return this.props.voidReason;
  }

  get charges(): Charge[] {
    return this.chargeList;
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

  pullDomainEvents(): InvoiceDomainEvent[] {
    const events = this.domainEvents;
    this.domainEvents = [];
    return events;
  }
}
