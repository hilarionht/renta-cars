import { Body, Controller, Get, Patch, Post } from '@nestjs/common';

import { Public, RequestContext, RequirePermission } from '@platform/persistence-kernel';
import {
  RegisterCompanyHandler,
  UpdateCompanyDetailsHandler,
} from '@platform/companies/application';

import { GetCompanyHandler } from '../queries/get-company.handler';
import { CompanyResponseDto } from './dto/company-response.dto';
import { RegisterCompanyRequestDto } from './dto/register-company-request.dto';
import { UpdateCompanyDetailsRequestDto } from './dto/update-company-details-request.dto';

// docs/contracts/02-RESOURCE-CATALOG.md SS2: "companies" es "siempre la propia" del token
// (sin {id} en el path), salvo el alta (POST, @Public() - todavia no existe ningun token
// para una company que no existe). suspend/reactivate no se exponen aca en esta tanda (ver
// plan de implementacion - requieren un mecanismo platform-admin que no existe todavia).
@Controller('companies')
export class CompaniesController {
  constructor(
    private readonly registerCompany: RegisterCompanyHandler,
    private readonly updateCompanyDetails: UpdateCompanyDetailsHandler,
    private readonly getCompany: GetCompanyHandler,
    private readonly requestContext: RequestContext,
  ) {}

  @Public()
  @Post()
  async register(@Body() dto: RegisterCompanyRequestDto): Promise<{ id: string }> {
    const id = await this.registerCompany.execute({
      legalName: dto.legalName,
      taxId: dto.taxId,
      billingContactEmail: dto.billingContactEmail,
      billingContactPhone: dto.billingContactPhone,
    });
    return { id: id.toString() };
  }

  @Get()
  async getSelf(): Promise<CompanyResponseDto> {
    const { companyId } = this.requestContext.get();
    return this.getCompany.execute({ companyId });
  }

  @Patch()
  @RequirePermission('companies:edit')
  async updateSelf(@Body() dto: UpdateCompanyDetailsRequestDto): Promise<void> {
    const { companyId } = this.requestContext.get();
    await this.updateCompanyDetails.execute({
      companyId,
      legalName: dto.legalName,
      billingContactEmail: dto.billingContactEmail,
      billingContactPhone: dto.billingContactPhone,
    });
  }
}
