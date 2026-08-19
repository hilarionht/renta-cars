import { EnabledProductModulesEmptyError } from '../errors/enabled-product-modules-empty.error';
import { PaymentMethodsEmptyError } from '../errors/payment-methods-empty.error';
import type { CompanySettingsUpdatedEvent } from '../events/company-settings-updated.event';
import { CancellationPolicy } from '../value-objects/cancellation-policy';
import { DepositPolicy } from '../value-objects/deposit-policy';
import { DraftExpirationPolicy } from '../value-objects/draft-expiration-policy';
import { LateReturnPolicy } from '../value-objects/late-return-policy';
import { MinimumBookingLeadTime } from '../value-objects/minimum-booking-lead-time';
import { PAYMENT_METHODS, PaymentMethod } from '../value-objects/payment-method';

type CompanySettingsDomainEvent = CompanySettingsUpdatedEvent;

export interface CompanySettingsProps {
  companyId: string;
  enabledProductModules: string[];
  paymentMethodsEnabled: PaymentMethod[];
  cancellationPolicy: CancellationPolicy;
  lateReturnPolicy: LateReturnPolicy;
  depositPolicy: DepositPolicy;
  draftExpirationPolicy: DraftExpirationPolicy;
  minimumBookingLeadTime: MinimumBookingLeadTime;
  createdAt: Date;
  updatedAt: Date;
  version: number;
}

// Aggregate root - docs/model/02-AGGREGATES.md SS6. Cubre 7 de las 9 politicas documentadas
// (EnabledProductModules, PaymentMethodsEnabled desde Fase 0; CancellationPolicy,
// LateReturnPolicy, DepositPolicy, DraftExpirationPolicy, MinimumBookingLeadTime agregadas en
// Reservations, docs/persistence/10-DECISIONES.md #59) - MaintenanceThresholdPolicy
// (Vehicles) y NotificationChannelPreference (Support) siguen fuera, sin consumidor real
// todavia. Identidad = companyId directo (string plano, sin EntityId propio) - primer
// aggregate root del modelo cuya identidad es prestada, no generada aca (docs/model/
// 03-ENTITIES.md SS2.3).
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
  // company restringe despues via PATCH); las 5 politicas de Reservation con sus defaults
  // neutrales documentados en cada VO (*.default()).
  static create(params: { companyId: string }): CompanySettings {
    const now = new Date();
    const settings = new CompanySettings({
      companyId: params.companyId,
      enabledProductModules: ['Rental'],
      paymentMethodsEnabled: PAYMENT_METHODS.map((value) => PaymentMethod.from(value)),
      cancellationPolicy: CancellationPolicy.default(),
      lateReturnPolicy: LateReturnPolicy.default(),
      depositPolicy: DepositPolicy.default(),
      draftExpirationPolicy: DraftExpirationPolicy.default(),
      minimumBookingLeadTime: MinimumBookingLeadTime.default(),
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

  get cancellationPolicy(): CancellationPolicy {
    return this.props.cancellationPolicy;
  }

  get lateReturnPolicy(): LateReturnPolicy {
    return this.props.lateReturnPolicy;
  }

  get depositPolicy(): DepositPolicy {
    return this.props.depositPolicy;
  }

  get draftExpirationPolicy(): DraftExpirationPolicy {
    return this.props.draftExpirationPolicy;
  }

  get minimumBookingLeadTime(): MinimumBookingLeadTime {
    return this.props.minimumBookingLeadTime;
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

  updateCancellationPolicy(policy: CancellationPolicy): void {
    this.props.cancellationPolicy = policy;
    this.props.updatedAt = new Date();
    this.props.version += 1;
    this.domainEvents.push({
      eventType: 'CompanySettingsUpdated.v1',
      companyId: this.props.companyId,
      policyName: 'cancellation-policy',
      newValueSummary: JSON.stringify(policy.tiers),
    });
  }

  updateLateReturnPolicy(policy: LateReturnPolicy): void {
    this.props.lateReturnPolicy = policy;
    this.props.updatedAt = new Date();
    this.props.version += 1;
    this.domainEvents.push({
      eventType: 'CompanySettingsUpdated.v1',
      companyId: this.props.companyId,
      policyName: 'late-return-policy',
      newValueSummary: JSON.stringify({
        graceMinutes: policy.graceMinutes,
        penaltyPercentagePerHour: policy.penaltyPercentagePerHour,
      }),
    });
  }

  updateDepositPolicy(policy: DepositPolicy): void {
    this.props.depositPolicy = policy;
    this.props.updatedAt = new Date();
    this.props.version += 1;
    this.domainEvents.push({
      eventType: 'CompanySettingsUpdated.v1',
      companyId: this.props.companyId,
      policyName: 'deposit-policy',
      newValueSummary: JSON.stringify({
        applies: policy.applies,
        percentageOfTotal: policy.percentageOfTotal,
      }),
    });
  }

  updateDraftExpirationPolicy(policy: DraftExpirationPolicy): void {
    this.props.draftExpirationPolicy = policy;
    this.props.updatedAt = new Date();
    this.props.version += 1;
    this.domainEvents.push({
      eventType: 'CompanySettingsUpdated.v1',
      companyId: this.props.companyId,
      policyName: 'draft-expiration-policy',
      newValueSummary: JSON.stringify({ expirationMinutes: policy.expirationMinutes }),
    });
  }

  updateMinimumBookingLeadTime(policy: MinimumBookingLeadTime): void {
    this.props.minimumBookingLeadTime = policy;
    this.props.updatedAt = new Date();
    this.props.version += 1;
    this.domainEvents.push({
      eventType: 'CompanySettingsUpdated.v1',
      companyId: this.props.companyId,
      policyName: 'minimum-booking-lead-time',
      newValueSummary: JSON.stringify({ leadTimeMinutes: policy.leadTimeMinutes }),
    });
  }

  pullDomainEvents(): CompanySettingsDomainEvent[] {
    const events = this.domainEvents;
    this.domainEvents = [];
    return events;
  }
}
