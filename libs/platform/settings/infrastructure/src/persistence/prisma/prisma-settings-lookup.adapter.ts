import { Injectable } from '@nestjs/common';

import { ReadTransaction } from '@platform/persistence-kernel';
import type {
  CancellationPolicyView,
  DepositPolicyView,
  LateReturnPolicyView,
  MaintenanceThresholdPolicyView,
  SettingsLookupPort,
} from '@platform/settings/application';

// Consumido por apps/api (TenantModuleEnabledGuard) y por handlers que tambien corren FUERA de
// un request HTTP (p.ej. SendNotificationHandler desde el worker BullMQ del Reminder, #121):
// cada metodo pasa su companyId explicito a ReadTransaction.run() en vez de depender del
// RequestContext ambiente, que en un worker no existe (bug real, docs/persistence/
// 10-DECISIONES.md #131). En HTTP el resultado es identico: el companyId del caller es el del
// request.
// getCancellationPolicy/getLateReturnPolicy/getDraftExpirationPolicyMinutes/
// getMinimumBookingLeadTimeMinutes/getDepositPolicy: consumidos por Reservations
// (docs/persistence/10-DECISIONES.md #59).
@Injectable()
export class PrismaSettingsLookupAdapter implements SettingsLookupPort {
  constructor(private readonly readTransaction: ReadTransaction) {}

  async getEnabledProductModules(companyId: string): Promise<string[] | null> {
    const record = await this.readTransaction.run(
      (tx) =>
        tx.companySettings.findFirst({
          where: { companyId },
          select: { enabledProductModules: true },
        }),
      companyId,
    );
    return record?.enabledProductModules ?? null;
  }

  async getCancellationPolicy(companyId: string): Promise<CancellationPolicyView | null> {
    const record = await this.readTransaction.run(
      (tx) =>
        tx.companySettings.findFirst({
          where: { companyId },
          select: { cancellationPolicyTiers: true },
        }),
      companyId,
    );
    if (!record) {
      return null;
    }
    return {
      tiers: record.cancellationPolicyTiers as CancellationPolicyView['tiers'],
    };
  }

  async getLateReturnPolicy(companyId: string): Promise<LateReturnPolicyView | null> {
    const record = await this.readTransaction.run(
      (tx) =>
        tx.companySettings.findFirst({
          where: { companyId },
          select: { lateReturnGraceMinutes: true, lateReturnPenaltyPctPerHour: true },
        }),
      companyId,
    );
    if (!record) {
      return null;
    }
    return {
      graceMinutes: record.lateReturnGraceMinutes,
      penaltyPercentagePerHour: record.lateReturnPenaltyPctPerHour,
    };
  }

  async getDraftExpirationPolicyMinutes(companyId: string): Promise<number | null> {
    const record = await this.readTransaction.run(
      (tx) =>
        tx.companySettings.findFirst({
          where: { companyId },
          select: { draftExpirationMinutes: true },
        }),
      companyId,
    );
    return record?.draftExpirationMinutes ?? null;
  }

  async getMinimumBookingLeadTimeMinutes(companyId: string): Promise<number | null> {
    const record = await this.readTransaction.run(
      (tx) =>
        tx.companySettings.findFirst({
          where: { companyId },
          select: { minimumBookingLeadTimeMinutes: true },
        }),
      companyId,
    );
    return record?.minimumBookingLeadTimeMinutes ?? null;
  }

  async getDepositPolicy(companyId: string): Promise<DepositPolicyView | null> {
    const record = await this.readTransaction.run(
      (tx) =>
        tx.companySettings.findFirst({
          where: { companyId },
          select: { depositApplies: true, depositPercentageOfTotal: true },
        }),
      companyId,
    );
    if (!record) {
      return null;
    }
    return {
      applies: record.depositApplies,
      percentageOfTotal: record.depositPercentageOfTotal,
    };
  }

  async getPaymentMethodsEnabled(companyId: string): Promise<string[] | null> {
    const record = await this.readTransaction.run(
      (tx) =>
        tx.companySettings.findFirst({
          where: { companyId },
          select: { paymentMethodsEnabled: true },
        }),
      companyId,
    );
    return record?.paymentMethodsEnabled ?? null;
  }

  async getNotificationChannelPreference(companyId: string): Promise<string | null> {
    const record = await this.readTransaction.run(
      (tx) =>
        tx.companySettings.findFirst({
          where: { companyId },
          select: { notificationChannelPreference: true },
        }),
      companyId,
    );
    return record?.notificationChannelPreference ?? null;
  }

  async getMaintenanceThresholdPolicy(
    companyId: string,
  ): Promise<MaintenanceThresholdPolicyView | null> {
    const record = await this.readTransaction.run(
      (tx) =>
        tx.companySettings.findFirst({
          where: { companyId },
          select: {
            maintenanceThresholdApplies: true,
            maintenanceThresholdOdometerKm: true,
            maintenanceThresholdDays: true,
          },
        }),
      companyId,
    );
    if (!record) {
      return null;
    }
    return {
      applies: record.maintenanceThresholdApplies,
      odometerThresholdKm: record.maintenanceThresholdOdometerKm ?? undefined,
      daysThreshold: record.maintenanceThresholdDays ?? undefined,
    };
  }
}
