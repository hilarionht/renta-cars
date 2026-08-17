import { Body, Controller, Get, Patch } from '@nestjs/common';

import { RequestContext } from '@platform/persistence-kernel';
import {
  UpdateEnabledProductModulesHandler,
  UpdatePaymentMethodsEnabledHandler,
} from '@platform/settings/application';

import { GetCompanySettingsHandler } from '../queries/get-company-settings.handler';
import type { CompanySettingsResponseDto } from './dto/company-settings-response.dto';
import { UpdateEnabledProductModulesRequestDto } from './dto/update-enabled-product-modules-request.dto';
import { UpdatePaymentMethodsEnabledRequestDto } from './dto/update-payment-methods-enabled-request.dto';

// docs/contracts/02-RESOURCE-CATALOG.md SS2: "company-settings" siempre "la propia" del
// token (sin {id} en el path). Alcance acotado de esta tanda: solo 2 de las 9 politicas
// documentadas (ver docs/persistence/10-DECISIONES.md) - las otras 7 no tienen endpoint
// todavia.
@Controller('company-settings')
export class SettingsController {
  constructor(
    private readonly getCompanySettings: GetCompanySettingsHandler,
    private readonly updateEnabledProductModules: UpdateEnabledProductModulesHandler,
    private readonly updatePaymentMethodsEnabled: UpdatePaymentMethodsEnabledHandler,
    private readonly requestContext: RequestContext,
  ) {}

  @Get()
  async getSelf(): Promise<CompanySettingsResponseDto> {
    const { companyId } = this.requestContext.get();
    return this.getCompanySettings.execute({ companyId });
  }

  @Patch('enabled-product-modules')
  async updateModules(@Body() dto: UpdateEnabledProductModulesRequestDto): Promise<void> {
    const { companyId } = this.requestContext.get();
    await this.updateEnabledProductModules.execute({
      companyId,
      enabledProductModules: dto.enabledProductModules,
    });
  }

  @Patch('payment-methods-enabled')
  async updatePaymentMethods(@Body() dto: UpdatePaymentMethodsEnabledRequestDto): Promise<void> {
    const { companyId } = this.requestContext.get();
    await this.updatePaymentMethodsEnabled.execute({
      companyId,
      paymentMethods: dto.paymentMethodsEnabled,
    });
  }
}
