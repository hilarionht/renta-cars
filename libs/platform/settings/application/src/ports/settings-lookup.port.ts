// Puerto publico consumido por apps/api (TenantModuleEnabledGuard, docs/technical/
// 03-BACKEND-ARCHITECTURE.md SS7) - superficie minima de solo lectura, nunca expone
// SettingsRepository completo cross-modulo (docs/05-CONVENCIONES-BACKEND.md SS3).
// getCancellationPolicy/getLateReturnPolicy/getDraftExpirationPolicy/
// getMinimumBookingLeadTime/getDepositPolicy agregados para Reservations (docs/model/
// 09-DEPENDENCIES.md SS2, "CompanySettingsPort") - docs/persistence/10-DECISIONES.md #59.
// getDepositPolicy consumido desde Fase 2 por SecurityDepositHoldListener
// (platform-payments-infrastructure).
export const SETTINGS_LOOKUP_PORT = Symbol('SettingsLookupPort');

export interface CancellationPolicyView {
  tiers: { minHoursBeforeStart: number; penaltyPercentage: number }[];
}

export interface LateReturnPolicyView {
  graceMinutes: number;
  penaltyPercentagePerHour: number;
}

export interface DepositPolicyView {
  applies: boolean;
  percentageOfTotal: number;
}

export interface SettingsLookupPort {
  getEnabledProductModules(companyId: string): Promise<string[] | null>;
  getCancellationPolicy(companyId: string): Promise<CancellationPolicyView | null>;
  getLateReturnPolicy(companyId: string): Promise<LateReturnPolicyView | null>;
  getDraftExpirationPolicyMinutes(companyId: string): Promise<number | null>;
  getMinimumBookingLeadTimeMinutes(companyId: string): Promise<number | null>;
  getDepositPolicy(companyId: string): Promise<DepositPolicyView | null>;
  // Agregado para Payments (Fase 2, docs/model/04-VALUE_OBJECTS.md SS6: "PaymentMethod
  // debe pertenecer al PaymentMethodsEnabled vigente de la Company").
  getPaymentMethodsEnabled(companyId: string): Promise<string[] | null>;
  // Agregado para Notifications (Fase 3 item 1, RN-33) - primer consumidor real.
  getNotificationChannelPreference(companyId: string): Promise<string | null>;
}
