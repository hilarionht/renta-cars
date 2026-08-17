import { EnabledProductModulesEmptyError } from '../errors/enabled-product-modules-empty.error';
import { PaymentMethodsEmptyError } from '../errors/payment-methods-empty.error';
import type { CompanySettingsUpdatedEvent } from '../events/company-settings-updated.event';
import { PAYMENT_METHODS, PaymentMethod } from '../value-objects/payment-method';

type CompanySettingsDomainEvent = CompanySettingsUpdatedEvent;

export interface CompanySettingsProps {
  companyId: string;
  enabledProductModules: string[];
  paymentMethodsEnabled: PaymentMethod[];
  createdAt: Date;
  updatedAt: Date;
  version: number;
}

// Aggregate root - docs/model/02-AGGREGATES.md SS6. Alcance acotado de esta tanda: solo 2 de
// las 9 politicas documentadas (EnabledProductModules, PaymentMethodsEnabled) - las otras 7
// son reglas de negocio de Rental Operations que todavia no existe (Fase 1), ver docs/
// persistence/10-DECISIONES.md. Identidad = companyId directo (string plano, sin EntityId
// propio) - primer aggregate root del modelo cuya identidad es prestada, no generada aca
// (docs/model/03-ENTITIES.md SS2.3).
export class CompanySettings {
  private domainEvents: CompanySettingsDomainEvent[] = [];
  private isNewAggregate = false;

  private constructor(private props: CompanySettingsProps) {}

  // Sin evento propio - el catalogo (docs/model/06-DOMAIN_EVENTS.md SS4) solo lista
  // CompanySettingsUpdated.v1, que por su nombre reacciona a un cambio real de una politica
  // existente, no a la fijacion inicial de defaults - mismo criterio que
  // Company.reactivate()/User.reactivate(). Defaults: EnabledProductModules=['Rental'] (unico
  // producto real de la Plataforma hoy); PaymentMethodsEnabled=los 4 del catalogo (default
  // tecnicamente neutral, sin base documental para curar un subconjunto de arranque - la
  // company restringe despues via PATCH).
  static create(params: { companyId: string }): CompanySettings {
    const now = new Date();
    const settings = new CompanySettings({
      companyId: params.companyId,
      enabledProductModules: ['Rental'],
      paymentMethodsEnabled: PAYMENT_METHODS.map((value) => PaymentMethod.from(value)),
      createdAt: now,
      updatedAt: now,
      version: 1,
    });
    settings.isNewAggregate = true;
    return settings;
  }

  static reconstitute(props: CompanySettingsProps): CompanySettings {
    return new CompanySettings(props);
  }

  get companyId(): string {
    return this.props.companyId;
  }

  get enabledProductModules(): string[] {
    return this.props.enabledProductModules;
  }

  get paymentMethodsEnabled(): PaymentMethod[] {
    return this.props.paymentMethodsEnabled;
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

  // EnabledProductModules es un conjunto ABIERTO por diseño (docs/contracts/
  // 08-VERSIONING.md SS5: "nunca una lista cerrada exhaustiva") - solo se valida no-vacio y
  // strings no-blancas, nunca contra un catalogo cerrado (a diferencia de PaymentMethod).
  updateEnabledProductModules(modules: string[]): void {
    const trimmed = modules.map((module) => module.trim()).filter((module) => module.length > 0);
    if (trimmed.length === 0) {
      throw new EnabledProductModulesEmptyError();
    }
    this.props.enabledProductModules = trimmed;
    this.props.updatedAt = new Date();
    this.props.version += 1;
    this.domainEvents.push({
      eventType: 'CompanySettingsUpdated.v1',
      companyId: this.props.companyId,
      policyName: 'enabled-product-modules',
      newValueSummary: JSON.stringify(trimmed),
    });
  }

  updatePaymentMethods(methods: PaymentMethod[]): void {
    if (methods.length === 0) {
      throw new PaymentMethodsEmptyError();
    }
    this.props.paymentMethodsEnabled = methods;
    this.props.updatedAt = new Date();
    this.props.version += 1;
    this.domainEvents.push({
      eventType: 'CompanySettingsUpdated.v1',
      companyId: this.props.companyId,
      policyName: 'payment-methods-enabled',
      newValueSummary: JSON.stringify(methods.map((method) => method.toString())),
    });
  }

  pullDomainEvents(): CompanySettingsDomainEvent[] {
    const events = this.domainEvents;
    this.domainEvents = [];
    return events;
  }
}
