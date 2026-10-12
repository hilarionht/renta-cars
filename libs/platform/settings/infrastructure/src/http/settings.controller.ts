import { Body, Controller, Get, Patch } from '@nestjs/common';

import { RequestContext, RequirePermission } from '@platform/persistence-kernel';
import {
  UpdateCancellationPolicyHandler,
  UpdateDepositPolicyHandler,
  UpdateDraftExpirationPolicyHandler,
  UpdateEnabledProductModulesHandler,
  UpdateLateReturnPolicyHandler,
  UpdateMaintenanceThresholdPolicyHandler,
  UpdateMinimumBookingLeadTimeHandler,
  UpdateNotificationChannelPreferenceHandler,
  UpdatePaymentMethodsEnabledHandler,
  UpdateReminderLeadTimeHandler,
} from '@platform/settings/application';

import { GetCompanySettingsHandler } from '../queries/get-company-settings.handler';
import type { CompanySettingsResponseDto } from './dto/company-settings-response.dto';
import { UpdateCancellationPolicyRequestDto } from './dto/update-cancellation-policy-request.dto';
import { UpdateDepositPolicyRequestDto } from './dto/update-deposit-policy-request.dto';
import { UpdateDraftExpirationPolicyRequestDto } from './dto/update-draft-expiration-policy-request.dto';
import { UpdateEnabledProductModulesRequestDto } from './dto/update-enabled-product-modules-request.dto';
import { UpdateLateReturnPolicyRequestDto } from './dto/update-late-return-policy-request.dto';
import { UpdateMaintenanceThresholdPolicyRequestDto } from './dto/update-maintenance-threshold-policy-request.dto';
import { UpdateMinimumBookingLeadTimeRequestDto } from './dto/update-minimum-booking-lead-time-request.dto';
import { UpdateNotificationChannelPreferenceRequestDto } from './dto/update-notification-channel-preference-request.dto';
import { UpdatePaymentMethodsEnabledRequestDto } from './dto/update-payment-methods-enabled-request.dto';
import { UpdateReminderLeadTimeRequestDto } from './dto/update-reminder-lead-time-request.dto';

// docs/contracts/02-RESOURCE-CATALOG.md SS2: "company-settings" siempre "la propia" del
// token (sin {id} en el path). Cubre las 10 politicas documentadas - las 5 de Reservation
// agregadas en docs/persistence/10-DECISIONES.md #59, NotificationChannelPreference (Fase 3
// item 1), MaintenanceThresholdPolicy (Fase 4 item 2) y ReminderLeadTime (#121), cada una con
// su propio PATCH (mismo criterio que enabled-product-modules/payment-methods-enabled: "cada
// actualizacion de una politica individual es una transaccion sobre el agregado completo",
// docs/model/02-AGGREGATES.md SS6).
@Controller('company-settings')
export class SettingsController {
  constructor(
    private readonly getCompanySettings: GetCompanySettingsHandler,
    private readonly updateEnabledProductModules: UpdateEnabledProductModulesHandler,
    private readonly updatePaymentMethodsEnabled: UpdatePaymentMethodsEnabledHandler,
    private readonly updateCancellationPolicy: UpdateCancellationPolicyHandler,
    private readonly updateLateReturnPolicy: UpdateLateReturnPolicyHandler,
    private readonly updateDepositPolicy: UpdateDepositPolicyHandler,
    private readonly updateDraftExpirationPolicy: UpdateDraftExpirationPolicyHandler,
    private readonly updateMinimumBookingLeadTime: UpdateMinimumBookingLeadTimeHandler,
    private readonly updateNotificationChannelPreference: UpdateNotificationChannelPreferenceHandler,
    private readonly updateMaintenanceThresholdPolicy: UpdateMaintenanceThresholdPolicyHandler,
    private readonly updateReminderLeadTime: UpdateReminderLeadTimeHandler,
    private readonly requestContext: RequestContext,
  ) {}

  @Get()
  async getSelf(): Promise<CompanySettingsResponseDto> {
    const { companyId } = this.requestContext.get();
    return this.getCompanySettings.execute({ companyId });
  }

  @Patch('enabled-product-modules')
  @RequirePermission('settings:manage')
  async updateModules(@Body() dto: UpdateEnabledProductModulesRequestDto): Promise<void> {
    const { companyId } = this.requestContext.get();
    await this.updateEnabledProductModules.execute({
      companyId,
      enabledProductModules: dto.enabledProductModules,
    });
  }

  @Patch('payment-methods-enabled')
  @RequirePermission('settings:manage')
  async updatePaymentMethods(@Body() dto: UpdatePaymentMethodsEnabledRequestDto): Promise<void> {
    const { companyId } = this.requestContext.get();
    await this.updatePaymentMethodsEnabled.execute({
      companyId,
      paymentMethods: dto.paymentMethodsEnabled,
    });
  }

  @Patch('cancellation-policy')
  @RequirePermission('settings:manage')
  async updateCancellation(@Body() dto: UpdateCancellationPolicyRequestDto): Promise<void> {
    const { companyId } = this.requestContext.get();
    await this.updateCancellationPolicy.execute({ companyId, tiers: dto.tiers });
  }

  @Patch('late-return-policy')
  @RequirePermission('settings:manage')
  async updateLateReturn(@Body() dto: UpdateLateReturnPolicyRequestDto): Promise<void> {
    const { companyId } = this.requestContext.get();
    await this.updateLateReturnPolicy.execute({
      companyId,
      graceMinutes: dto.graceMinutes,
      penaltyPercentagePerHour: dto.penaltyPercentagePerHour,
    });
  }

  @Patch('deposit-policy')
  @RequirePermission('settings:manage')
  async updateDeposit(@Body() dto: UpdateDepositPolicyRequestDto): Promise<void> {
    const { companyId } = this.requestContext.get();
    await this.updateDepositPolicy.execute({
      companyId,
      applies: dto.applies,
      percentageOfTotal: dto.percentageOfTotal,
    });
  }

  @Patch('draft-expiration-policy')
  @RequirePermission('settings:manage')
  async updateDraftExpiration(@Body() dto: UpdateDraftExpirationPolicyRequestDto): Promise<void> {
    const { companyId } = this.requestContext.get();
    await this.updateDraftExpirationPolicy.execute({
      companyId,
      expirationMinutes: dto.expirationMinutes,
    });
  }

  @Patch('minimum-booking-lead-time')
  @RequirePermission('settings:manage')
  async updateMinimumLeadTime(@Body() dto: UpdateMinimumBookingLeadTimeRequestDto): Promise<void> {
    const { companyId } = this.requestContext.get();
    await this.updateMinimumBookingLeadTime.execute({
      companyId,
      leadTimeMinutes: dto.leadTimeMinutes,
    });
  }

  @Patch('notification-channel-preference')
  @RequirePermission('settings:manage')
  async updateNotificationChannel(
    @Body() dto: UpdateNotificationChannelPreferenceRequestDto,
  ): Promise<void> {
    const { companyId } = this.requestContext.get();
    await this.updateNotificationChannelPreference.execute({
      companyId,
      preferredChannel: dto.preferredChannel,
    });
  }

  @Patch('maintenance-threshold-policy')
  @RequirePermission('settings:manage')
  async updateMaintenanceThreshold(
    @Body() dto: UpdateMaintenanceThresholdPolicyRequestDto,
  ): Promise<void> {
    const { companyId } = this.requestContext.get();
    await this.updateMaintenanceThresholdPolicy.execute({
      companyId,
      applies: dto.applies,
      odometerThresholdKm: dto.odometerThresholdKm,
      daysThreshold: dto.daysThreshold,
    });
  }

  @Patch('reminder-lead-time')
  @RequirePermission('settings:manage')
  async updateReminderLead(@Body() dto: UpdateReminderLeadTimeRequestDto): Promise<void> {
    const { companyId } = this.requestContext.get();
    await this.updateReminderLeadTime.execute({
      companyId,
      leadTimeMinutes: dto.leadTimeMinutes,
    });
  }
}
