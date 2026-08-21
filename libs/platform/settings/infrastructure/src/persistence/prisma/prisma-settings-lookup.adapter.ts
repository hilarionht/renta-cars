import { Injectable } from '@nestjs/common';

import { ReadTransaction } from '@platform/persistence-kernel';
import type {
  CancellationPolicyView,
  DepositPolicyView,
  LateReturnPolicyView,
  SettingsLookupPort,
} from '@platform/settings/application';

// Consumido por apps/api (TenantModuleEnabledGuard) - corre despues de TenantContextGuard,
// que ya poblo RequestContext desde el JWT, asi que ReadTransaction ambiente alcanza.
// getCancellationPolicy/getLateReturnPolicy/getDraftExpirationPolicyMinutes/
// getMinimumBookingLeadTimeMinutes/getDepositPolicy: consumidos por Reservations
// (docs/persistence/10-DECISIONES.md #59).
@Injectable()
export class PrismaSettingsLookupAdapter implements SettingsLookupPort {
  constructor(private readonly readTransaction: ReadTransaction) {}

  async getEnabledProductModules(companyId: string): Promise<string[] | null> {
    const record = await this.readTransaction.run((tx) =>
      tx.companySettings.findFirst({
        where: { companyId },
        select: { enabledProductModules: true },
      }),
    );
    return record?.enabledProductModules ?? null;
  }

  async getCancellationPolicy(companyId: string): Promise<CancellationPolicyView | null> {
    const record = await this.readTransaction.run((tx) =>
      tx.companySettings.findFirst({
        where: { companyId },
        select: { cancellationPolicyTiers: true },
      }),
    );
    if (!record) {
      return null;
    }
    return {
      tiers: record.cancellationPolicyTiers as CancellationPolicyView['tiers'],
    };
  }

  async getLateReturnPolicy(companyId: string): Promise<LateReturnPolicyView | null> {
    const record = await this.readTransaction.run((tx) =>
      tx.companySettings.findFirst({
        where: { companyId },
        select: { lateReturnGraceMinutes: true, lateReturnPenaltyPctPerHour: true },
      }),
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
    const record = await this.readTransaction.run((tx) =>
      tx.companySettings.findFirst({
        where: { companyId },
        select: { draftExpirationMinutes: true },
      }),
    );
    return record?.draftExpirationMinutes ?? null;
  }

  async getMinimumBookingLeadTimeMinutes(companyId: string): Promise<number | null> {
    const record = await this.readTransaction.run((tx) =>
      tx.companySettings.findFirst({
        where: { companyId },
        select: { minimumBookingLeadTimeMinutes: true },
      }),
    );
    return record?.minimumBookingLeadTimeMinutes ?? null;
  }

  async getDepositPolicy(companyId: string): Promise<DepositPolicyView | null> {
    const record = await this.readTransaction.run((tx) =>
      tx.companySettings.findFirst({
        where: { companyId },
        select: { depositApplies: true, depositPercentageOfTotal: true },
      }),
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
    const record = await this.readTransaction.run((tx) =>
      tx.companySettings.findFirst({
        where: { companyId },
        select: { paymentMethodsEnabled: true },
      }),
    );
    return record?.paymentMethodsEnabled ?? null;
  }
}
