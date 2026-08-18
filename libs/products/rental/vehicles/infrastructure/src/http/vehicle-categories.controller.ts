import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';

import { RequestContext, RequiresProductModule } from '@platform/persistence-kernel';
import { AddRateHandler, CreateVehicleCategoryHandler } from '@rental/vehicles/application';

import { GetVehicleCategoryHandler } from '../queries/get-vehicle-category.handler';
import { ListVehicleCategoriesHandler } from '../queries/list-vehicle-categories.handler';
import { AddRateRequestDto } from './dto/add-rate-request.dto';
import { CreateVehicleCategoryRequestDto } from './dto/create-vehicle-category-request.dto';
import type { VehicleCategoryResponseDto } from './dto/vehicle-category-response.dto';
import type { VehicleCategorySummaryResponseDto } from './dto/vehicle-category-summary-response.dto';

// docs/contracts/02-RESOURCE-CATALOG.md SS4: "vehicle-categories" siempre escopeado por la
// company del token.
@RequiresProductModule('Rental')
@Controller('vehicle-categories')
export class VehicleCategoriesController {
  constructor(
    private readonly createVehicleCategory: CreateVehicleCategoryHandler,
    private readonly addRate: AddRateHandler,
    private readonly getVehicleCategory: GetVehicleCategoryHandler,
    private readonly listVehicleCategories: ListVehicleCategoriesHandler,
    private readonly requestContext: RequestContext,
  ) {}

  @Post()
  async create(@Body() dto: CreateVehicleCategoryRequestDto): Promise<{ id: string }> {
    const { companyId } = this.requestContext.get();
    const id = await this.createVehicleCategory.execute({
      companyId,
      name: dto.name,
      description: dto.description,
    });
    return { id: id.toString() };
  }

  @Get()
  async list(): Promise<VehicleCategorySummaryResponseDto[]> {
    const { companyId } = this.requestContext.get();
    return this.listVehicleCategories.execute({ companyId });
  }

  @Get(':id')
  async get(@Param('id', ParseUUIDPipe) id: string): Promise<VehicleCategoryResponseDto> {
    const { companyId } = this.requestContext.get();
    return this.getVehicleCategory.execute({ vehicleCategoryId: id, companyId });
  }

  @Post(':id/rates')
  async addNewRate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddRateRequestDto,
  ): Promise<{ id: string }> {
    const { companyId } = this.requestContext.get();
    const rateId = await this.addRate.execute({
      vehicleCategoryId: id,
      companyId,
      amountMinorUnits: dto.amountMinorUnits,
      currency: dto.currency,
      unit: dto.unit,
      validFrom: new Date(dto.validFrom),
      validTo: dto.validTo ? new Date(dto.validTo) : undefined,
    });
    return { id: rateId };
  }
}
